import { Hono, type Context, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@rapport/core";
import type { Config } from "./config";
import type { DB } from "./db";
import type { Repo } from "./repo";

const SESSION_COOKIE = "rapport_session";
const OAUTH_COOKIE = "rapport_oauth";
const SESSION_DAYS = 30;

export type AuthEnv = { Variables: { user: User } };

const b64url = (buf: Buffer) => buf.toString("base64url");

/** Session ids are random; only their hash is stored, so a DB leak does not leak live sessions. */
const hashId = (id: string) => createHash("sha256").update(id).digest("hex");

export class Sessions {
  constructor(
    private db: DB,
    private repo: Repo,
    private config: Config,
  ) {}

  start(c: Context, userId: string) {
    const id = b64url(randomBytes(32));
    const expires = Date.now() + SESSION_DAYS * 86_400_000;
    this.db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(hashId(id), userId, expires);
    this.db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
    setCookie(c, SESSION_COOKIE, id, {
      httpOnly: true,
      secure: this.config.production,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_DAYS * 86_400,
    });
  }

  current(c: Context): User | null {
    const id = getCookie(c, SESSION_COOKIE);
    if (!id) return null;
    const row = this.db.prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?").get(hashId(id)) as
      | { user_id: string; expires_at: number }
      | undefined;
    if (!row || row.expires_at < Date.now()) return null;
    return this.repo.getUser(row.user_id);
  }

  end(c: Context) {
    const id = getCookie(c, SESSION_COOKIE);
    if (id) this.db.prepare("DELETE FROM sessions WHERE id = ?").run(hashId(id));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
  }
}

/** Rejects unauthenticated requests and cross-site writes. */
export function requireUser(sessions: Sessions): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD" && c.req.header("X-Requested-With") !== "rapport") {
      return c.json({ error: "Missing X-Requested-With header" }, 403);
    }
    const user = sessions.current(c);
    if (!user) return c.json({ error: "Not signed in" }, 401);
    c.set("user", user);
    await next();
  };
}

/**
 * Google OAuth 2.0 authorization-code flow with PKCE and a state check.
 * Only ALLOWED_EMAILS may sign in (the MVP is single-user).
 */
export function authRoutes(config: Config, repo: Repo, sessions: Sessions, fetchImpl: typeof fetch = fetch) {
  const app = new Hono();
  const redirectUri = `${config.appUrl}/auth/google/callback`;

  app.get("/config", (c) => c.json({ google: Boolean(config.google), devLogin: config.devLogin }));

  app.get("/google", (c) => {
    if (!config.google) return c.text("Google sign-in is not configured", 503);
    const state = b64url(randomBytes(16));
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    setCookie(c, OAUTH_COOKIE, `${state}.${verifier}`, {
      httpOnly: true,
      secure: config.production,
      sameSite: "Lax",
      path: "/auth",
      maxAge: 600,
    });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return c.redirect(url.toString());
  });

  app.get("/google/callback", async (c) => {
    const fail = (reason: string) => c.redirect(`/login?error=${encodeURIComponent(reason)}`);
    if (!config.google) return fail("Google sign-in is not configured");
    const cookie = getCookie(c, OAUTH_COOKIE) ?? "";
    deleteCookie(c, OAUTH_COOKIE, { path: "/auth" });
    const [state, verifier] = cookie.split(".");
    const code = c.req.query("code");
    if (c.req.query("error")) return fail("Sign-in was cancelled");
    if (!code || !state || !verifier || c.req.query("state") !== state) return fail("Sign-in expired, please try again");

    const tokenRes = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) return fail("Google rejected the sign-in");
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) return fail("Google rejected the sign-in");

    const infoRes = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) return fail("Could not read your Google profile");
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string; picture?: string };
    const email = info.email?.toLowerCase();
    if (!email || !info.email_verified) return fail("Your Google email is not verified");
    if (config.allowedEmails.length > 0 && !config.allowedEmails.includes(email)) {
      return fail("This account is not allowed to use this Rapport instance");
    }

    const user = repo.upsertUser(email, info.name ?? null, info.picture ?? null);
    sessions.start(c, user.id);
    return c.redirect("/");
  });

  app.post("/logout", (c) => {
    sessions.end(c);
    return c.body(null, 204);
  });

  // Local development only: sign in without Google. Refused in production by loadConfig.
  app.post("/dev-login", (c) => {
    if (!config.devLogin || config.production) return c.json({ error: "Not found" }, 404);
    if (c.req.header("X-Requested-With") !== "rapport") return c.json({ error: "Missing X-Requested-With header" }, 403);
    const user = repo.upsertUser("dev@localhost", "Dev User", null);
    sessions.start(c, user.id);
    return c.json(user);
  });

  return app;
}
