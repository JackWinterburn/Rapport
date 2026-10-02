import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { loadConfig } from "./config";
import { openDb } from "./db";
import { createApp } from "./app";
import { Push, startReminderScheduler } from "./push";

const config = loadConfig();
const db = openDb(config.databasePath);
const push = new Push(db, config);
const { app, repo } = createApp({ config, db, push });

if (config.webDistDir) {
  const root = config.webDistDir;
  // The service worker and HTML must never be cached by the browser's HTTP cache.
  app.use("*", async (c, next) => {
    await next();
    const p = c.req.path;
    if (p === "/sw.js" || p.endsWith(".html") || p === "/") c.header("Cache-Control", "no-cache");
    else if (p.startsWith("/assets/")) c.header("Cache-Control", "public, max-age=31536000, immutable");
  });
  app.use("*", serveStatic({ root }));
  // SPA fallback for client-side routes.
  app.get("*", serveStatic({ root, path: "index.html" }));
}

startReminderScheduler(repo, push);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Rapport server listening on http://localhost:${info.port}`);
  if (!config.google) console.log("Google OAuth is not configured; set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.");
  if (config.devLogin) console.log("DEV_LOGIN is enabled (local development only).");
  if (!config.gemini.apiKey) console.log("GEMINI_API_KEY is not set; AI capture is disabled.");
});
