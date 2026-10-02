import { FACT_TYPE_LABELS, keyDateTitle, type ContactDetail } from "@rapport/core";
import type { Config } from "./config";
import type { DB } from "./db";

export class AiError extends Error {
  constructor(
    public status: 429 | 502 | 503,
    message: string,
  ) {
    super(message);
  }
}

export const SYSTEM_PROMPT = `You help one person remember details about the people in their life.
They describe a conversation they just had with a contact. Propose short, structured updates to that contact's profile.

Rules:
- Only use what the user actually wrote. Never guess, embellish or infer. If it is not stated, leave it out.
- Every suggestion must include "evidence": a short exact quote copied from the user's text that supports it.
- Do NOT propose anything about health, medical conditions, pregnancy, mental health, religion or beliefs,
  sexual orientation, romantic relationships, dating or divorce, politics, ethnicity, trade union membership,
  or money/finances/employment loss. Skip those topics entirely, even if the user mentioned them.
- Do not repeat details already on the profile.
- Keep each "text" short (under 12 words), written as a profile entry, not a sentence about the conversation.
  Good: "Training for the Berlin marathon". Bad: "She told me she is training for a marathon".
- Types: "interest" (hobbies, topics they love), "habit" (routines, things they regularly do),
  "preference" (likes/dislikes, food, drinks, how they like things), "giftIdea" (things they want or would enjoy),
  "keyDate" (a specific calendar date such as a birthday or anniversary; set month and day as numbers, year only if stated,
  and dateLabel such as "birthday", "anniversary" or a short label), "followUp" (something the user should do or ask about next time),
  "other" (other useful facts, e.g. names of children or pets, where they live, their job).
- "summary": one or two neutral sentences recording what the conversation was about, in the user's own terms, excluding sensitive topics.
- If nothing is worth remembering, return an empty suggestions list.`;

/** Gemini structured-output schema (OpenAPI subset). */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    suggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["interest", "habit", "preference", "giftIdea", "other", "keyDate", "followUp"] },
          text: { type: "STRING" },
          evidence: { type: "STRING" },
          dateLabel: { type: "STRING", nullable: true },
          month: { type: "INTEGER", nullable: true },
          day: { type: "INTEGER", nullable: true },
          year: { type: "INTEGER", nullable: true },
        },
        required: ["type", "text", "evidence"],
      },
    },
  },
  required: ["summary", "suggestions"],
};

/** Only what the model needs: name, how they know them and non-private details. No contact info, no photos. */
export function buildUserPrompt(contact: ContactDetail, text: string, todayIso: string): string {
  const facts = contact.facts.filter((f) => !f.private).map((f) => `- ${FACT_TYPE_LABELS[f.type]}: ${f.text}`);
  const dates = contact.keyDates.map((d) => `- ${keyDateTitle(d)}: ${d.day}/${d.month}${d.year ? `/${d.year}` : ""}`);
  return [
    `Today is ${todayIso}.`,
    `Contact: ${contact.nickname || contact.name}${contact.howWeKnow ? ` (${contact.howWeKnow})` : ""}`,
    "Already on their profile:",
    ...(facts.length || dates.length ? [...facts, ...dates] : ["- (nothing yet)"]),
    "",
    "What the user wrote about the conversation:",
    '"""',
    text,
    '"""',
  ].join("\n");
}

export interface AiUsageRow {
  month: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

export function currentMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

export function getUsage(db: DB, userId: string, month = currentMonth()): AiUsageRow {
  const r = db.prepare("SELECT * FROM ai_usage WHERE user_id = ? AND month = ?").get(userId, month) as Record<string, number> | undefined;
  return { month, requests: r?.requests ?? 0, inputTokens: r?.input_tokens ?? 0, outputTokens: r?.output_tokens ?? 0 };
}

function recordUsage(db: DB, userId: string, input: number, output: number) {
  db.prepare(
    `INSERT INTO ai_usage (user_id, month, requests, input_tokens, output_tokens) VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(user_id, month) DO UPDATE SET requests = requests + 1, input_tokens = input_tokens + excluded.input_tokens, output_tokens = output_tokens + excluded.output_tokens`,
  ).run(userId, currentMonth(), input, output);
}

/** Calls Gemini and returns the raw JSON object. The caller sanitizes it with core's sanitizeSuggestions. */
export async function runCapture(
  config: Config,
  db: DB,
  userId: string,
  contact: ContactDetail,
  text: string,
  todayIso: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const { apiKey, model, monthlyTokenLimit, baseUrl } = config.gemini;
  if (!apiKey) throw new AiError(503, "AI capture is not configured. Set GEMINI_API_KEY on the server.");
  const usage = getUsage(db, userId);
  if (usage.inputTokens + usage.outputTokens >= monthlyTokenLimit) {
    throw new AiError(429, "Monthly AI limit reached. It resets at the start of next month.");
  }

  const res = await fetchImpl(`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(contact, text, todayIso) }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => {
    throw new AiError(502, "Could not reach the AI service. Try again.");
  });

  if (res.status === 429) throw new AiError(429, "The AI service is busy. Try again in a minute.");
  if (!res.ok) {
    console.error("Gemini error", res.status, (await res.text()).slice(0, 500));
    throw new AiError(502, "The AI service returned an error. Try again.");
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  recordUsage(
    db,
    userId,
    data.usageMetadata?.promptTokenCount ?? 0,
    (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0),
  );
  const out = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  try {
    return JSON.parse(out);
  } catch {
    throw new AiError(502, "The AI returned something unreadable. Try again.");
  }
}
