import webpush from "web-push";
import { keyDateTitle, nextOccurrence, daysBetween, todayLocal, toIsoDay, isReminderDue } from "@rapport/core";
import type { Config } from "./config";
import { getSetting, nowIso, setSetting, type DB } from "./db";
import type { Repo } from "./repo";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/**
 * Web push with VAPID. Keys come from env, or are generated once and stored in
 * the database so existing subscriptions keep working across restarts.
 */
export class Push {
  readonly publicKey: string;

  constructor(
    private db: DB,
    config: Config,
  ) {
    let keys = config.vapid;
    if (!keys) {
      const stored = getSetting(db, "vapid");
      if (stored) keys = JSON.parse(stored);
      else {
        const generated = webpush.generateVAPIDKeys();
        keys = { ...generated, subject: "mailto:admin@example.com" };
        setSetting(db, "vapid", JSON.stringify(keys));
      }
    }
    this.publicKey = keys!.publicKey;
    webpush.setVapidDetails(keys!.subject, keys!.publicKey, keys!.privateKey);
  }

  subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    this.db
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      )
      .run(sub.endpoint, userId, sub.keys.p256dh, sub.keys.auth, nowIso());
  }

  unsubscribe(userId: string, endpoint: string) {
    this.db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").run(endpoint, userId);
  }

  async send(userId: string, payload: PushPayload): Promise<number> {
    const subs = this.db.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?").all(userId) as {
      endpoint: string;
      p256dh: string;
      auth: string;
    }[];
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86_400 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // Gone or not found: the browser dropped the subscription.
        if (status === 404 || status === 410) this.db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(s.endpoint);
        else console.error("Push failed", status, (e as Error).message);
      }
    }
    return sent;
  }
}

/** Sends at most one push per key date occurrence, once it is inside its reminder lead time. */
export async function sendDueReminders(repo: Repo, push: Pick<Push, "send">, now = new Date(), sendFromHour = 9): Promise<number> {
  // Wait until morning (server time zone, set TZ) so reminders do not arrive at midnight.
  if (now.getHours() < sendFromHour) return 0;
  const today = todayLocal(now);
  let count = 0;
  for (const kd of repo.reminderCandidates()) {
    if (!isReminderDue(kd, today)) continue;
    const next = nextOccurrence(kd, today)!;
    const occurrence = toIsoDay(next);
    if (kd.lastNotifiedFor === occurrence) continue;
    const until = daysBetween(today, next);
    const when = until === 0 ? "today" : until === 1 ? "tomorrow" : `in ${until} days`;
    const title = `${kd.contactName}'s ${keyDateTitle(kd).toLowerCase()} is ${when}`;
    await push.send(kd.userId, {
      title,
      body: kd.label === "birthday" && until > 0 ? "Open their profile for gift ideas." : "Open their profile to see your notes.",
      url: `/contacts/${kd.contactId}`,
      tag: `kd-${kd.id}-${occurrence}`,
    });
    repo.markNotified(kd.id, occurrence);
    count++;
  }
  return count;
}

export function startReminderScheduler(repo: Repo, push: Push, intervalMs = 15 * 60_000) {
  const tick = () => sendDueReminders(repo, push).catch((e) => console.error("Reminder run failed", e));
  void tick();
  return setInterval(tick, intervalMs);
}
