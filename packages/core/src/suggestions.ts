import { z } from "zod";
import { FACT_TYPES, KEY_DATE_LABELS, daysInMonth, isoDay, type Fact } from "./models";
import { normalize } from "./search";

/**
 * AI conversation capture.
 *
 * The model returns a flat list of proposed updates. Before anything reaches the
 * user, `sanitizeSuggestions` drops items that are malformed, not grounded in what
 * the user wrote, sensitive, or already on the profile. Nothing is saved until the
 * user approves each card.
 */

export const SUGGESTION_TYPES = [...FACT_TYPES, "keyDate", "followUp"] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

/** Shape the model is asked to produce. Loose on purpose: validation happens in sanitize. */
export const rawCaptureSchema = z.object({
  summary: z.string().default(""),
  suggestions: z
    .array(
      z.object({
        type: z.string(),
        text: z.string().default(""),
        evidence: z.string().default(""),
        dateLabel: z.string().nullish(),
        month: z.number().nullish(),
        day: z.number().nullish(),
        year: z.number().nullish(),
      }),
    )
    .default([]),
});
export type RawCapture = z.infer<typeof rawCaptureSchema>;

export const suggestionSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("fact"),
    factType: z.enum(FACT_TYPES),
    text: z.string().trim().min(1).max(500),
    evidence: z.string().max(1000).default(""),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("keyDate"),
    text: z.string().trim().min(1).max(200),
    evidence: z.string().max(1000).default(""),
    label: z.enum(KEY_DATE_LABELS),
    customLabel: z.string().trim().max(60).nullable(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    year: z.number().int().min(1900).max(2200).nullable(),
  }),
]);
export type Suggestion = z.infer<typeof suggestionSchema>;

export interface CaptureProposal {
  summary: string;
  suggestions: Suggestion[];
  /** Counts of what was filtered out, for transparency in the UI. */
  dropped: { ungrounded: number; sensitive: number; duplicate: number; invalid: number };
}

export const captureRequest = z.object({
  text: z.string().trim().min(3, "Describe the conversation first").max(4000, "Keep it under 4,000 characters"),
});

export const captureCommit = z.object({
  text: z.string().trim().min(1).max(4000),
  summary: z.string().trim().min(1).max(2000),
  date: isoDay,
  accepted: z.array(suggestionSchema).max(50),
});
export type CaptureCommit = z.input<typeof captureCommit>;

/**
 * Special-category topics the AI must never propose (UK GDPR art. 9 plus finances).
 * The prompt forbids them too; this is the backstop. Users can still add them by hand.
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  // health
  /\b(ill|illness|sick|disease|diagnos\w*|cancer|tumou?r|diabet\w*|depress\w*|anxiety|adhd|autis\w*|pregnan\w*|miscarr\w*|therap(y|ist)|medicat\w*|surgery|hospital\w*|chemo\w*|disab\w*|mental health|rehab|addict\w*|ivf|fertility|hiv)\b/i,
  // religion and beliefs
  /\b(religio\w*|christian\w*|muslim|islam\w*|jewish|judaism|hindu\w*|buddhis\w*|sikh\w*|atheis\w*|church|mosque|synagogue|temple|pray\w*|faith)\b/i,
  // sexuality and relationships
  /\b(gay|lesbian|bisexual|queer|transgender|sexual\w*|sex life|dating|divorc\w*|separat(ed|ion)|affair|breakup|broke up|girlfriend|boyfriend)\b/i,
  // politics, ethnicity, union membership
  /\b(politic\w*|conservative|labour party|democrat\w*|republican|vote[sd]?|ethnic\w*|racial|trade union)\b/i,
  // finances
  /\b(debt|bankrupt\w*|salary|income|mortgage|loan|broke|money troubles?|financial\w*|redundan\w*|laid off|unemploy\w*)\b/i,
];

export function isSensitive(text: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(text));
}

/** Evidence must be (nearly) a verbatim quote from what the user wrote. */
export function isGrounded(evidence: string, source: string): boolean {
  const e = normalize(evidence).replace(/[^\p{L}\p{N} ]/gu, "");
  if (e.length < 3) return false;
  const s = normalize(source).replace(/[^\p{L}\p{N} ]/gu, "");
  if (s.includes(e)) return true;
  // Allow light paraphrase: 80% of evidence words appear in the source.
  const words = e.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) return false;
  const hits = words.filter((w) => s.includes(w)).length;
  return hits / words.length >= 0.8;
}

function similar(a: string, b: string): boolean {
  const na = normalize(a).replace(/[^\p{L}\p{N} ]/gu, "");
  const nb = normalize(b).replace(/[^\p{L}\p{N} ]/gu, "");
  return na === nb || (na.length > 4 && nb.length > 4 && (na.includes(nb) || nb.includes(na)));
}

let counter = 0;
const nextId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

export function sanitizeSuggestions(
  raw: unknown,
  sourceText: string,
  existingFacts: Pick<Fact, "text" | "type">[],
  makeId: () => string = nextId,
): CaptureProposal {
  const dropped = { ungrounded: 0, sensitive: 0, duplicate: 0, invalid: 0 };
  const parsed = rawCaptureSchema.safeParse(raw);
  if (!parsed.success) return { summary: "", suggestions: [], dropped: { ...dropped, invalid: 1 } };

  const suggestions: Suggestion[] = [];
  const seen: string[] = existingFacts.map((f) => f.text);

  for (const item of parsed.data.suggestions) {
    const type = item.type as SuggestionType;
    if (!SUGGESTION_TYPES.includes(type)) {
      dropped.invalid++;
      continue;
    }
    const text = item.text.trim();
    if (!text) {
      dropped.invalid++;
      continue;
    }
    if (isSensitive(text) || isSensitive(item.evidence)) {
      dropped.sensitive++;
      continue;
    }
    if (!isGrounded(item.evidence, sourceText)) {
      dropped.ungrounded++;
      continue;
    }

    if (type === "keyDate") {
      const month = item.month ?? 0;
      const day = item.day ?? 0;
      const year = item.year ?? null;
      if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month, year ?? 2000)) {
        dropped.invalid++;
        continue;
      }
      const lbl = normalize(item.dateLabel ?? "");
      const label = lbl.includes("birthday") ? "birthday" : lbl.includes("anniversary") ? "anniversary" : "other";
      const s = suggestionSchema.safeParse({
        id: makeId(),
        kind: "keyDate",
        text,
        evidence: item.evidence,
        label,
        customLabel: label === "other" ? (item.dateLabel?.trim() || text).slice(0, 60) : null,
        month,
        day,
        year,
      });
      if (s.success) suggestions.push(s.data);
      else dropped.invalid++;
      continue;
    }

    const factType = type === "followUp" ? "other" : type;
    const factText = type === "followUp" && !/^follow[\s-]?up/i.test(text) ? `Follow up: ${text}` : text;
    if (seen.some((t) => similar(t, factText))) {
      dropped.duplicate++;
      continue;
    }
    const s = suggestionSchema.safeParse({ id: makeId(), kind: "fact", factType, text: factText, evidence: item.evidence });
    if (s.success) {
      suggestions.push(s.data);
      seen.push(factText);
    } else dropped.invalid++;
  }

  let summary = parsed.data.summary.trim().slice(0, 2000);
  if (!summary || isSensitive(summary)) summary = sourceText.trim().slice(0, 280);
  return { summary, suggestions, dropped };
}
