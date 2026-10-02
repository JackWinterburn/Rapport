import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { ContactDetail, ContactSummary, CaptureProposal } from "@rapport/core";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { openDb } from "./db";
import { sendDueReminders } from "./push";

type App = ReturnType<typeof createApp>["app"];

const geminiReply = (obj: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    }),
    { status: 200 },
  );

function setup(env: Record<string, string> = {}, fetchStub?: typeof fetch) {
  const config = loadConfig({ DEV_LOGIN: "true", GEMINI_API_KEY: "test-key", DATABASE_PATH: ":memory:", ...env } as NodeJS.ProcessEnv);
  const db = openDb(":memory:");
  const pushes: unknown[] = [];
  const push = {
    publicKey: "pk",
    subscribe: () => {},
    unsubscribe: () => {},
    send: async (_u: string, p: unknown) => {
      pushes.push(p);
      return 1;
    },
  };
  const { app, repo } = createApp({ config, db, push, fetch: fetchStub, now: () => new Date(2026, 9, 2, 12) });
  return { app, repo, db, pushes, push };
}

async function login(app: App): Promise<string> {
  const res = await app.request("/auth/dev-login", { method: "POST", headers: { "X-Requested-With": "rapport" } });
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

function client(app: App, cookie: string) {
  return async <T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> => {
    const res = await app.request(path, {
      method,
      headers: { Cookie: cookie, "X-Requested-With": "rapport", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, data: (text && res.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text) as T };
  };
}

describe("auth", () => {
  it("requires a session and the CSRF header", async () => {
    const { app } = setup();
    expect((await app.request("/api/contacts")).status).toBe(401);
    const cookie = await login(app);
    expect((await app.request("/api/contacts", { headers: { Cookie: cookie } })).status).toBe(200);
    const noHeader = await app.request("/api/contacts", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(noHeader.status).toBe(403);
  });

  it("refuses dev login when disabled, and in production config", async () => {
    const { app } = setup({ DEV_LOGIN: "false" });
    expect((await app.request("/auth/dev-login", { method: "POST", headers: { "X-Requested-With": "rapport" } })).status).toBe(404);
    expect(() => loadConfig({ NODE_ENV: "production", DEV_LOGIN: "true" } as NodeJS.ProcessEnv)).toThrow();
  });

  it("runs the Google OAuth flow with state + PKCE and enforces the allowlist", async () => {
    let tokenBody = "";
    const fetchStub = (async (url: string, init?: RequestInit) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        tokenBody = String(init?.body);
        return new Response(JSON.stringify({ access_token: "at" }));
      }
      if (url.includes("userinfo")) return new Response(JSON.stringify({ email: "Jack@Example.com", email_verified: true, name: "Jack" }));
      throw new Error("unexpected " + url);
    }) as typeof fetch;
    const { app } = setup({ GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "sec", ALLOWED_EMAILS: "jack@example.com" }, fetchStub);

    const start = await app.request("/auth/google");
    expect(start.status).toBe(302);
    const loc = new URL(start.headers.get("location")!);
    expect(loc.host).toBe("accounts.google.com");
    expect(loc.searchParams.get("code_challenge_method")).toBe("S256");
    const state = loc.searchParams.get("state")!;
    const oauthCookie = start.headers.get("set-cookie")!.split(";")[0]!;

    const bad = await app.request(`/auth/google/callback?code=c&state=wrong`, { headers: { Cookie: oauthCookie } });
    expect(bad.headers.get("location")).toContain("/login?error=");

    const ok = await app.request(`/auth/google/callback?code=c&state=${state}`, { headers: { Cookie: oauthCookie } });
    expect(ok.headers.get("location")).toBe("/");
    expect(tokenBody).toContain("code_verifier=");
    const session = ok.headers.getSetCookie().find((c) => c.startsWith("rapport_session="))!.split(";")[0]!;
    const me = await app.request("/api/me", { headers: { Cookie: session } });
    expect(await me.json()).toMatchObject({ email: "jack@example.com" });
  });

  it("rejects emails not on the allowlist", async () => {
    const fetchStub = (async (url: string) =>
      url.includes("token")
        ? new Response(JSON.stringify({ access_token: "at" }))
        : new Response(JSON.stringify({ email: "eve@example.com", email_verified: true }))) as typeof fetch;
    const { app } = setup({ GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "sec", ALLOWED_EMAILS: "jack@example.com" }, fetchStub);
    const start = await app.request("/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state");
    const res = await app.request(`/auth/google/callback?code=c&state=${state}`, { headers: { Cookie: start.headers.get("set-cookie")!.split(";")[0]! } });
    expect(res.headers.get("location")).toContain("not%20allowed");
  });
});

describe("contacts API", () => {
  let api: ReturnType<typeof client>;
  let app: App;
  let repo: ReturnType<typeof setup>["repo"];
  let db: ReturnType<typeof setup>["db"];
  beforeEach(async () => {
    ({ app, repo, db } = setup());
    api = client(app, await login(app));
  });

  it("creates a contact with groups, tags, facts and dates", async () => {
    const { data: groups } = await api<{ id: string; name: string }[]>("GET", "/api/groups");
    expect(groups.map((g) => g.name)).toEqual(["Family", "Friends", "Work"]);
    const { status, data } = await api<ContactDetail>("POST", "/api/contacts", {
      name: "Priya Shah",
      groupIds: [groups[1]!.id, "not-mine"],
      tagNames: ["climbing", "Climbing", "running"],
      facts: [{ type: "interest", text: "Bouldering" }],
      keyDates: [{ label: "birthday", month: 6, day: 14, reminderDays: 7 }],
    });
    expect(status).toBe(201);
    expect(data.groupIds).toEqual([groups[1]!.id]);
    expect(data.tagIds).toHaveLength(2);
    expect(data.facts[0]).toMatchObject({ text: "Bouldering", source: "manual" });
    expect(data.keyDates[0]).toMatchObject({ month: 6, day: 14, reminderDays: 7 });

    const { data: list } = await api<ContactSummary[]>("GET", "/api/contacts");
    expect(list).toHaveLength(1);
    expect(list[0]!.facts).toHaveLength(1);
  });

  it("validates input", async () => {
    expect((await api("POST", "/api/contacts", { name: "" })).status).toBe(400);
    const { data: c } = await api<ContactDetail>("POST", "/api/contacts", { name: "Sam" });
    expect((await api("POST", `/api/contacts/${c.id}/dates`, { label: "birthday", month: 2, day: 30 })).status).toBe(400);
  });

  it("isolates users from each other", async () => {
    const { data: mine } = await api<ContactDetail>("POST", "/api/contacts", { name: "Mine" });
    // A second user with their own session on the same database.
    const eve = repo.upsertUser("eve@example.com", "Eve", null);
    const sid = "eve-session";
    db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
      createHash("sha256").update(sid).digest("hex"),
      eve.id,
      Date.now() + 60_000,
    );
    const eveApi = client(app, `rapport_session=${sid}`);
    expect((await eveApi<unknown[]>("GET", "/api/contacts")).data).toEqual([]);
    expect((await eveApi("GET", `/api/contacts/${mine.id}`)).status).toBe(404);
    expect((await eveApi("PATCH", `/api/contacts/${mine.id}`, { name: "Hacked" })).status).toBe(404);
    expect((await eveApi("DELETE", `/api/contacts/${mine.id}`)).status).toBe(404);
    expect((await eveApi("POST", `/api/contacts/${mine.id}/facts`, { type: "interest", text: "x" })).status).toBe(404);
    expect((await api<ContactDetail>("GET", `/api/contacts/${mine.id}`)).data.name).toBe("Mine");
  });

  it("adds notes, updates last interacted, edits facts and tags", async () => {
    const { data: c } = await api<ContactDetail>("POST", "/api/contacts", { name: "Sam", tagNames: ["old"] });
    await api("POST", `/api/contacts/${c.id}/interactions`, { summary: "Lunch", date: "2026-09-30" });
    const { data: fact } = await api<{ id: string }>("POST", `/api/contacts/${c.id}/facts`, { type: "giftIdea", text: "Book" });
    await api("PATCH", `/api/facts/${fact.id}`, { private: true });
    await api("PATCH", `/api/contacts/${c.id}`, { tagNames: ["new"] });
    const { data } = await api<ContactDetail>("GET", `/api/contacts/${c.id}`);
    expect(data.lastInteracted).toBe("2026-09-30");
    expect(data.interactions[0]).toMatchObject({ kind: "note", summary: "Lunch" });
    expect(data.facts[0]).toMatchObject({ private: true });
    const { data: tags } = await api<{ name: string }[]>("GET", "/api/tags");
    expect(tags.map((t) => t.name)).toEqual(["new"]);
  });

  it("exports JSON and CSV, and deletes everything", async () => {
    await api("POST", "/api/contacts", { name: "Sam", facts: [{ type: "interest", text: "Chess" }] });
    const { data: json } = await api<{ format: string; contacts: unknown[] }>("GET", "/api/export.json");
    expect(json.format).toBe("rapport-export");
    expect(json.contacts).toHaveLength(1);
    const csv = await app.request("/api/export.csv", { headers: { Cookie: (await login(app)) } });
    expect(await csv.text()).toContain("Chess");
    expect((await api("DELETE", "/api/data", {})).status).toBe(400);
    expect((await api("DELETE", "/api/data", { confirm: "DELETE" })).status).toBe(204);
    expect((await api<unknown[]>("GET", "/api/contacts")).data).toEqual([]);
  });
});

describe("AI capture", () => {
  it("proposes sanitized suggestions without writing, then commits approved ones", async () => {
    let sentBody = "";
    const fetchStub = (async (_url: string, init?: RequestInit) => {
      sentBody = String(init?.body);
      return geminiReply({
        summary: "Coffee catch-up about her marathon.",
        suggestions: [
          { type: "interest", text: "Marathon running", evidence: "training for the Berlin marathon" },
          { type: "giftIdea", text: "Garmin watch", evidence: "wants a new Garmin watch" },
          { type: "keyDate", text: "Birthday", evidence: "birthday is 14 June", dateLabel: "birthday", month: 6, day: 14 },
          { type: "other", text: "Recently in hospital", evidence: "been in hospital" },
          { type: "habit", text: "Swims daily", evidence: "swims every day" },
        ],
      });
    }) as typeof fetch;
    const { app } = setup({}, fetchStub);
    const api = client(app, await login(app));
    const { data: c } = await api<ContactDetail>("POST", "/api/contacts", {
      name: "Priya",
      phone: "07700 900000",
      facts: [{ type: "preference", text: "Secret thing", private: true }],
    });
    const text = "Coffee with Priya. She's training for the Berlin marathon and wants a new Garmin watch. Her birthday is 14 June. She's been in hospital.";

    const { status, data: proposal } = await api<CaptureProposal>("POST", `/api/contacts/${c.id}/capture`, { text });
    expect(status).toBe(200);
    expect(proposal.suggestions.map((s) => s.text)).toEqual(["Marathon running", "Garmin watch", "Birthday"]);
    expect(proposal.dropped).toMatchObject({ sensitive: 1, ungrounded: 1 });
    // Private facts and contact details are never sent to the model.
    expect(sentBody).not.toContain("Secret thing");
    expect(sentBody).not.toContain("07700");

    const unchanged = await api<ContactDetail>("GET", `/api/contacts/${c.id}`);
    expect(unchanged.data.facts).toHaveLength(1);

    const accepted = [proposal.suggestions[1]!, proposal.suggestions[2]!];
    const { data: after } = await api<ContactDetail>("POST", `/api/contacts/${c.id}/capture/commit`, {
      text,
      summary: proposal.summary,
      date: "2026-10-02",
      accepted,
    });
    expect(after.facts.map((f) => [f.text, f.source])).toContainEqual(["Garmin watch", "ai"]);
    expect(after.facts.some((f) => f.text === "Marathon running")).toBe(false);
    expect(after.keyDates[0]).toMatchObject({ label: "birthday", month: 6, day: 14, reminderDays: 7 });
    expect(after.interactions[0]).toMatchObject({ kind: "capture", summary: "Coffee catch-up about her marathon." });
    expect(after.interactions[0]!.linkedFactIds).toHaveLength(1);
    expect(after.lastInteracted).toBe("2026-10-02");

    const { data: usage } = await api<{ requests: number; inputTokens: number }>("GET", "/api/ai/usage");
    expect(usage).toMatchObject({ requests: 1, inputTokens: 100 });
  });

  it("enforces the monthly token limit and reports a missing key", async () => {
    const fetchStub = (async () => geminiReply({ summary: "s", suggestions: [] })) as typeof fetch;
    const { app } = setup({ AI_MONTHLY_TOKEN_LIMIT: "100" }, fetchStub);
    const api = client(app, await login(app));
    const { data: c } = await api<ContactDetail>("POST", "/api/contacts", { name: "Sam" });
    expect((await api("POST", `/api/contacts/${c.id}/capture`, { text: "We talked about chess." })).status).toBe(200);
    expect((await api("POST", `/api/contacts/${c.id}/capture`, { text: "We talked about chess." })).status).toBe(429);

    const noKey = setup({ GEMINI_API_KEY: "" });
    const api2 = client(noKey.app, await login(noKey.app));
    const { data: c2 } = await api2<ContactDetail>("POST", "/api/contacts", { name: "Sam" });
    expect((await api2("POST", `/api/contacts/${c2.id}/capture`, { text: "We talked about chess." })).status).toBe(503);
  });
});

describe("reminders", () => {
  it("sends one push per occurrence inside the lead time, after 9am", async () => {
    const { app, repo, pushes, push } = setup();
    const api = client(app, await login(app));
    await api("POST", "/api/contacts", { name: "Priya", keyDates: [{ label: "birthday", month: 10, day: 5, reminderDays: 7 }] });
    await api("POST", "/api/contacts", { name: "Far", keyDates: [{ label: "birthday", month: 12, day: 25, reminderDays: 7 }] });

    expect(await sendDueReminders(repo, push, new Date(2026, 9, 2, 7))).toBe(0);
    expect(await sendDueReminders(repo, push, new Date(2026, 9, 2, 10))).toBe(1);
    expect(await sendDueReminders(repo, push, new Date(2026, 9, 3, 10))).toBe(0);
    expect(pushes[0]).toMatchObject({ title: "Priya's birthday is in 3 days" });
  });
});
