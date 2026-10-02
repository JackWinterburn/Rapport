export interface Config {
  production: boolean;
  port: number;
  /** Public origin of the app, e.g. https://rapport.example.com. Used for OAuth redirects. */
  appUrl: string;
  databasePath: string;
  google: { clientId: string; clientSecret: string } | null;
  /** Lower-cased emails allowed to sign in. Empty = anyone with a Google account. */
  allowedEmails: string[];
  devLogin: boolean;
  gemini: { apiKey: string | null; model: string; monthlyTokenLimit: number; baseUrl: string };
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  webDistDir: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === "production";
  const port = Number(env.PORT ?? 8787);
  const devLogin = env.DEV_LOGIN === "true";
  if (production && devLogin) throw new Error("DEV_LOGIN must not be enabled in production");

  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : null;
  if (production && !google) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production");

  const allowedEmails = (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (production && allowedEmails.length === 0) {
    throw new Error("Set ALLOWED_EMAILS in production so only you can sign in");
  }

  return {
    production,
    port,
    appUrl: (env.APP_URL ?? `http://localhost:${production ? port : 5173}`).replace(/\/$/, ""),
    databasePath: env.DATABASE_PATH ?? "rapport.db",
    google,
    allowedEmails,
    devLogin,
    gemini: {
      apiKey: env.GEMINI_API_KEY || null,
      model: env.GEMINI_MODEL || "gemini-3.1-flash-lite",
      monthlyTokenLimit: Number(env.AI_MONTHLY_TOKEN_LIMIT ?? 2_000_000),
      baseUrl: (env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com").replace(/\/$/, ""),
    },
    vapid:
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT ?? "mailto:admin@example.com" }
        : null,
    webDistDir: env.WEB_DIST_DIR ?? (production ? "../web/dist" : null),
  };
}
