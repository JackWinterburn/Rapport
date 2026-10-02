import { Hono, type Context } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import {
  captureCommit,
  captureRequest,
  contactInput,
  contactPatch,
  contactsToCsv,
  factInput,
  factPatch,
  groupInput,
  keyDateInput,
  noteInput,
  notePatch,
  sanitizeSuggestions,
  tagPatch,
  todayLocal,
  toIsoDay,
  type ExportBundle,
} from "@rapport/core";
import type { Config } from "./config";
import { transaction, type DB } from "./db";
import { NotFound, Repo } from "./repo";
import { authRoutes, requireUser, Sessions, type AuthEnv } from "./auth";
import { AiError, getUsage, runCapture } from "./ai";
import type { Push } from "./push";

export interface AppDeps {
  config: Config;
  db: DB;
  push: Pick<Push, "publicKey" | "subscribe" | "unsubscribe" | "send">;
  /** Injected so tests can stub Google and Gemini. */
  fetch?: typeof fetch;
  now?: () => Date;
}

class BadRequest extends Error {
  constructor(public details: unknown) {
    super("Invalid request");
  }
}

async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw new BadRequest("Body must be JSON");
  }
  const r = schema.safeParse(json);
  if (!r.success) throw new BadRequest(z.flattenError(r.error));
  return r.data;
}

const pushSubscription = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(200) }),
});

export function createApp(deps: AppDeps) {
  const { config, db, push } = deps;
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const repo = new Repo(db);
  const sessions = new Sessions(db, repo, config);

  const app = new Hono();

  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.googleusercontent.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    }),
  );

  app.onError((err, c) => {
    if (err instanceof BadRequest) return c.json({ error: "Invalid request", details: err.details }, 400);
    if (err instanceof NotFound) return c.json({ error: err.message }, 404);
    if (err instanceof AiError) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: "Something went wrong" }, 500);
  });

  app.get("/healthz", (c) => c.text("ok"));
  app.route("/auth", authRoutes(config, repo, sessions, fetchImpl));

  const api = new Hono<AuthEnv>();
  api.use("*", bodyLimit({ maxSize: 2 * 1024 * 1024, onError: (c) => c.json({ error: "Request too large" }, 413) }));
  api.use("*", requireUser(sessions));
  api.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "private, no-cache");
  });

  const uid = (c: Context<AuthEnv>) => c.get("user").id;
  const today = () => toIsoDay(todayLocal(now()));

  api.get("/me", (c) => c.json(c.get("user")));

  // Contacts
  api.get("/contacts", (c) => c.json(repo.listContacts(uid(c))));
  api.post("/contacts", async (c) => c.json(repo.createContact(uid(c), await body(c, contactInput)), 201));
  api.get("/contacts/:id", (c) => c.json(repo.getContact(uid(c), c.req.param("id"))));
  api.patch("/contacts/:id", async (c) => c.json(repo.updateContact(uid(c), c.req.param("id"), await body(c, contactPatch))));
  api.delete("/contacts/:id", (c) => {
    repo.deleteContact(uid(c), c.req.param("id"));
    return c.body(null, 204);
  });

  // Facts
  api.post("/contacts/:id/facts", async (c) => c.json(repo.addFact(uid(c), c.req.param("id"), await body(c, factInput)), 201));
  api.patch("/facts/:id", async (c) => c.json(repo.updateFact(uid(c), c.req.param("id"), await body(c, factPatch))));
  api.delete("/facts/:id", (c) => {
    repo.deleteFact(uid(c), c.req.param("id"));
    return c.body(null, 204);
  });

  // Key dates
  api.post("/contacts/:id/dates", async (c) => c.json(repo.addKeyDate(uid(c), c.req.param("id"), await body(c, keyDateInput)), 201));
  api.put("/dates/:id", async (c) => c.json(repo.replaceKeyDate(uid(c), c.req.param("id"), await body(c, keyDateInput))));
  api.delete("/dates/:id", (c) => {
    repo.deleteKeyDate(uid(c), c.req.param("id"));
    return c.body(null, 204);
  });

  // Notes and history
  api.post("/contacts/:id/interactions", async (c) => {
    const n = await body(c, noteInput);
    return c.json(repo.addInteraction(uid(c), c.req.param("id"), { kind: "note", date: n.date ?? today(), summary: n.summary, private: n.private }), 201);
  });
  api.patch("/interactions/:id", async (c) => c.json(repo.updateInteraction(uid(c), c.req.param("id"), await body(c, notePatch))));
  api.delete("/interactions/:id", (c) => {
    repo.deleteInteraction(uid(c), c.req.param("id"));
    return c.body(null, 204);
  });

  // Groups and tags
  api.get("/groups", (c) => c.json(repo.listGroups(uid(c))));
  api.post("/groups", async (c) => c.json(repo.createGroup(uid(c), await body(c, groupInput)), 201));
  api.patch("/groups/:id", async (c) => c.json(repo.updateGroup(uid(c), c.req.param("id"), await body(c, groupInput.partial()))));
  api.delete("/groups/:id", (c) => {
    repo.deleteGroup(uid(c), c.req.param("id"));
    return c.body(null, 204);
  });
  api.get("/tags", (c) => c.json(repo.listTags(uid(c))));
  api.patch("/tags/:id", async (c) => c.json(repo.renameTag(uid(c), c.req.param("id"), (await body(c, tagPatch)).name)));
  api.delete("/tags/:id", (c) => {
    repo.deleteTag(uid(c), c.req.param("id"));
    return c.body(null, 204);
  });

  // AI conversation capture: propose (no writes), then commit what the user approved.
  api.post("/contacts/:id/capture", async (c) => {
    const { text } = await body(c, captureRequest);
    const contact = repo.getContact(uid(c), c.req.param("id"));
    const raw = await runCapture(config, db, uid(c), contact, text, today(), fetchImpl);
    return c.json(sanitizeSuggestions(raw, text, contact.facts));
  });

  api.post("/contacts/:id/capture/commit", async (c) => {
    const commit = await body(c, captureCommit);
    const userId = uid(c);
    const contactId = c.req.param("id");
    repo.getContact(userId, contactId);
    transaction(db, () => {
      const factIds: string[] = [];
      for (const s of commit.accepted) {
        if (s.kind === "fact") {
          factIds.push(repo.insertFact(userId, contactId, { type: s.factType, text: s.text, private: false }, "ai").id);
        } else {
          const kd = keyDateInput.safeParse({
            label: s.label,
            customLabel: s.customLabel,
            month: s.month,
            day: s.day,
            year: s.year,
            repeatsYearly: true,
            reminderDays: s.label === "birthday" ? 7 : null,
          });
          if (kd.success) repo.insertKeyDate(userId, contactId, kd.data);
        }
      }
      repo.addInteraction(userId, contactId, { kind: "capture", date: commit.date, summary: commit.summary, private: false, linkedFactIds: factIds });
    });
    return c.json(repo.getContact(userId, contactId));
  });

  api.get("/ai/usage", (c) =>
    c.json({
      ...getUsage(db, uid(c)),
      tokenLimit: config.gemini.monthlyTokenLimit,
      model: config.gemini.model,
      configured: Boolean(config.gemini.apiKey),
    }),
  );

  // Push
  api.get("/push/public-key", (c) => c.json({ publicKey: push.publicKey }));
  api.post("/push/subscribe", async (c) => {
    push.subscribe(uid(c), await body(c, pushSubscription));
    return c.body(null, 204);
  });
  api.delete("/push/subscribe", async (c) => {
    push.unsubscribe(uid(c), (await body(c, z.object({ endpoint: z.string() }))).endpoint);
    return c.body(null, 204);
  });
  api.post("/push/test", async (c) =>
    c.json({ sent: await push.send(uid(c), { title: "Notifications are on", body: "Rapport will remind you before birthdays and key dates.", url: "/upcoming" }) }),
  );

  // Data control
  const bundle = (userId: string): ExportBundle => ({ format: "rapport-export", version: 1, exportedAt: now().toISOString(), ...repo.exportAll(userId) });
  api.get("/export.json", (c) => {
    c.header("Content-Disposition", `attachment; filename="rapport-export-${today()}.json"`);
    return c.json(bundle(uid(c)));
  });
  api.get("/export.csv", (c) => {
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="rapport-contacts-${today()}.csv"`);
    return c.body(contactsToCsv(bundle(uid(c))));
  });
  api.delete("/data", async (c) => {
    await body(c, z.object({ confirm: z.literal("DELETE") }));
    repo.deleteEverything(uid(c));
    return c.body(null, 204);
  });

  app.route("/api", api);
  return { app, repo };
}
