import {
  colorForName,
  contactInput,
  contactPatch,
  type Color,
  type Contact,
  type ContactDetail,
  type ContactSummary,
  type Fact,
  type FactType,
  type Group,
  type Interaction,
  type KeyDate,
  type Tag,
  type User,
  type keyDateInput,
  type factInput,
} from "@rapport/core";
import type { z } from "zod";
import { newId, nowIso, transaction, type DB } from "./db";

/**
 * Data access. Every query is scoped by user id, so one user can never read or
 * change another user's rows even if they guess an id.
 */

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? null : String(v));

function toContact(r: Row): Contact {
  return {
    id: String(r.id),
    name: String(r.name),
    nickname: s(r.nickname),
    photo: s(r.photo),
    avatarColor: r.avatar_color as Color,
    howWeKnow: s(r.how_we_know),
    phone: s(r.phone),
    email: s(r.email),
    address: s(r.address),
    socials: JSON.parse(String(r.socials ?? "[]")),
    notes: s(r.notes),
    lastInteracted: s(r.last_interacted),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function toFact(r: Row): Fact {
  return {
    id: String(r.id),
    contactId: String(r.contact_id),
    type: r.type as FactType,
    text: String(r.text),
    source: r.source === "ai" ? "ai" : "manual",
    private: Boolean(r.private),
    createdAt: String(r.created_at),
  };
}

function toKeyDate(r: Row): KeyDate {
  return {
    id: String(r.id),
    contactId: String(r.contact_id),
    label: r.label as KeyDate["label"],
    customLabel: s(r.custom_label),
    month: Number(r.month),
    day: Number(r.day),
    year: r.year === null ? null : Number(r.year),
    repeatsYearly: Boolean(r.repeats_yearly),
    reminderDays: r.reminder_days === null ? null : Number(r.reminder_days),
  };
}

function toInteraction(r: Row, linked: string[]): Interaction {
  return {
    id: String(r.id),
    contactId: String(r.contact_id),
    date: String(r.date),
    kind: r.kind === "capture" ? "capture" : "note",
    summary: String(r.summary),
    private: Boolean(r.private),
    linkedFactIds: linked,
    createdAt: String(r.created_at),
  };
}

export class NotFound extends Error {}

export class Repo {
  constructor(private db: DB) {}

  // ---------------------------------------------------------------- users

  upsertUser(email: string, name: string | null, picture: string | null): User {
    const existing = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as Row | undefined;
    if (existing) {
      this.db.prepare("UPDATE users SET name = ?, picture = ? WHERE id = ?").run(name, picture, String(existing.id));
      return { id: String(existing.id), email, name, picture };
    }
    const id = newId();
    transaction(this.db, () => {
      this.db.prepare("INSERT INTO users (id, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?)").run(id, email, name, picture, nowIso());
      const seed: [string, Color][] = [
        ["Family", "orange"],
        ["Friends", "green"],
        ["Work", "blue"],
      ];
      seed.forEach(([n, c], i) =>
        this.db.prepare("INSERT INTO groups (id, user_id, name, color, position) VALUES (?, ?, ?, ?, ?)").run(newId(), id, n, c, i),
      );
    });
    return { id, email, name, picture };
  }

  getUser(id: string): User | null {
    const r = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
    return r ? { id: String(r.id), email: String(r.email), name: s(r.name), picture: s(r.picture) } : null;
  }

  // ------------------------------------------------------------- contacts

  private assertContact(userId: string, contactId: string) {
    const r = this.db.prepare("SELECT 1 FROM contacts WHERE id = ? AND user_id = ?").get(contactId, userId);
    if (!r) throw new NotFound("Contact not found");
  }

  listContacts(userId: string): ContactSummary[] {
    const contacts = (this.db.prepare("SELECT * FROM contacts WHERE user_id = ? ORDER BY name COLLATE NOCASE").all(userId) as Row[]).map(toContact);
    const facts = (this.db.prepare("SELECT * FROM facts WHERE user_id = ? ORDER BY created_at").all(userId) as Row[]).map(toFact);
    const dates = (this.db.prepare("SELECT * FROM key_dates WHERE user_id = ?").all(userId) as Row[]).map(toKeyDate);
    const cg = this.db
      .prepare("SELECT cg.contact_id, cg.group_id FROM contact_groups cg JOIN contacts c ON c.id = cg.contact_id WHERE c.user_id = ?")
      .all(userId) as Row[];
    const ct = this.db
      .prepare("SELECT ct.contact_id, ct.tag_id FROM contact_tags ct JOIN contacts c ON c.id = ct.contact_id WHERE c.user_id = ?")
      .all(userId) as Row[];

    const by = <T>(items: T[], key: (t: T) => string) => {
      const m = new Map<string, T[]>();
      for (const it of items) m.set(key(it), [...(m.get(key(it)) ?? []), it]);
      return m;
    };
    const factsBy = by(facts, (f) => f.contactId);
    const datesBy = by(dates, (d) => d.contactId);
    const groupsBy = by(cg, (r) => String(r.contact_id));
    const tagsBy = by(ct, (r) => String(r.contact_id));

    return contacts.map((c) => ({
      ...c,
      facts: factsBy.get(c.id) ?? [],
      keyDates: datesBy.get(c.id) ?? [],
      groupIds: (groupsBy.get(c.id) ?? []).map((r) => String(r.group_id)),
      tagIds: (tagsBy.get(c.id) ?? []).map((r) => String(r.tag_id)),
    }));
  }

  getContact(userId: string, id: string): ContactDetail {
    const r = this.db.prepare("SELECT * FROM contacts WHERE id = ? AND user_id = ?").get(id, userId) as Row | undefined;
    if (!r) throw new NotFound("Contact not found");
    const facts = (this.db.prepare("SELECT * FROM facts WHERE contact_id = ? ORDER BY created_at").all(id) as Row[]).map(toFact);
    const keyDates = (this.db.prepare("SELECT * FROM key_dates WHERE contact_id = ? ORDER BY month, day").all(id) as Row[]).map(toKeyDate);
    const groupIds = (this.db.prepare("SELECT group_id FROM contact_groups WHERE contact_id = ?").all(id) as Row[]).map((x) => String(x.group_id));
    const tagIds = (this.db.prepare("SELECT tag_id FROM contact_tags WHERE contact_id = ?").all(id) as Row[]).map((x) => String(x.tag_id));
    const links = this.db
      .prepare("SELECT f.interaction_id, f.fact_id FROM interaction_facts f JOIN interactions i ON i.id = f.interaction_id WHERE i.contact_id = ?")
      .all(id) as Row[];
    const interactions = (this.db.prepare("SELECT * FROM interactions WHERE contact_id = ? ORDER BY date DESC, created_at DESC").all(id) as Row[]).map((ir) =>
      toInteraction(
        ir,
        links.filter((l) => l.interaction_id === ir.id).map((l) => String(l.fact_id)),
      ),
    );
    return { ...toContact(r), facts, keyDates, groupIds, tagIds, interactions };
  }

  createContact(userId: string, input: z.output<typeof contactInput>): ContactDetail {
    const id = newId();
    const now = nowIso();
    transaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO contacts (id, user_id, name, nickname, photo, avatar_color, how_we_know, phone, email, address, socials, notes, last_interacted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          userId,
          input.name,
          input.nickname,
          input.photo,
          input.avatarColor ?? colorForName(input.name),
          input.howWeKnow,
          input.phone,
          input.email,
          input.address,
          JSON.stringify(input.socials),
          input.notes,
          input.lastInteracted,
          now,
          now,
        );
      this.setGroups(userId, id, input.groupIds);
      this.setTags(userId, id, input.tagNames);
      for (const f of input.facts) this.insertFact(userId, id, f, "manual");
      for (const d of input.keyDates) this.insertKeyDate(userId, id, d);
    });
    return this.getContact(userId, id);
  }

  updateContact(userId: string, id: string, patch: z.output<typeof contactPatch>): ContactDetail {
    this.assertContact(userId, id);
    const columns: Record<string, string> = {
      name: "name",
      nickname: "nickname",
      photo: "photo",
      avatarColor: "avatar_color",
      howWeKnow: "how_we_know",
      phone: "phone",
      email: "email",
      address: "address",
      notes: "notes",
      lastInteracted: "last_interacted",
    };
    transaction(this.db, () => {
      const sets: string[] = [];
      const values: (string | null)[] = [];
      for (const [key, col] of Object.entries(columns)) {
        if (key in patch && (patch as Record<string, unknown>)[key] !== undefined) {
          sets.push(`${col} = ?`);
          values.push((patch as Record<string, string | null>)[key] ?? null);
        }
      }
      if (patch.socials !== undefined) {
        sets.push("socials = ?");
        values.push(JSON.stringify(patch.socials));
      }
      sets.push("updated_at = ?");
      values.push(nowIso());
      this.db.prepare(`UPDATE contacts SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(...values, id, userId);
      if (patch.groupIds !== undefined) this.setGroups(userId, id, patch.groupIds);
      if (patch.tagNames !== undefined) this.setTags(userId, id, patch.tagNames);
    });
    return this.getContact(userId, id);
  }

  deleteContact(userId: string, id: string) {
    this.assertContact(userId, id);
    this.db.prepare("DELETE FROM contacts WHERE id = ? AND user_id = ?").run(id, userId);
    this.pruneTags(userId);
  }

  touchContact(userId: string, id: string, day: string) {
    // Only move last-interacted forward.
    this.db
      .prepare("UPDATE contacts SET last_interacted = ?, updated_at = ? WHERE id = ? AND user_id = ? AND (last_interacted IS NULL OR last_interacted < ?)")
      .run(day, nowIso(), id, userId, day);
  }

  private setGroups(userId: string, contactId: string, groupIds: string[]) {
    this.db.prepare("DELETE FROM contact_groups WHERE contact_id = ?").run(contactId);
    const own = this.db.prepare("SELECT 1 FROM groups WHERE id = ? AND user_id = ?");
    for (const gid of new Set(groupIds)) {
      if (own.get(gid, userId)) this.db.prepare("INSERT INTO contact_groups (contact_id, group_id) VALUES (?, ?)").run(contactId, gid);
    }
  }

  private setTags(userId: string, contactId: string, names: string[]) {
    this.db.prepare("DELETE FROM contact_tags WHERE contact_id = ?").run(contactId);
    const unique = new Map(names.map((n) => [n.trim().toLowerCase(), n.trim()]));
    for (const [lower, name] of unique) {
      if (!lower) continue;
      let tag = this.db.prepare("SELECT id FROM tags WHERE user_id = ? AND lower(name) = ?").get(userId, lower) as Row | undefined;
      if (!tag) {
        const tid = newId();
        this.db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(tid, userId, name);
        tag = { id: tid };
      }
      this.db.prepare("INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)").run(contactId, String(tag.id));
    }
    this.pruneTags(userId);
  }

  /** Tags exist only while some contact uses them. */
  private pruneTags(userId: string) {
    this.db.prepare("DELETE FROM tags WHERE user_id = ? AND id NOT IN (SELECT tag_id FROM contact_tags)").run(userId);
  }

  // ---------------------------------------------------------------- facts

  insertFact(userId: string, contactId: string, f: z.output<typeof factInput>, source: "manual" | "ai"): Fact {
    const id = newId();
    this.db
      .prepare("INSERT INTO facts (id, user_id, contact_id, type, text, source, private, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, userId, contactId, f.type, f.text, source, f.private ? 1 : 0, nowIso());
    return this.getFact(userId, id);
  }

  addFact(userId: string, contactId: string, f: z.output<typeof factInput>): Fact {
    this.assertContact(userId, contactId);
    return this.insertFact(userId, contactId, f, "manual");
  }

  getFact(userId: string, id: string): Fact {
    const r = this.db.prepare("SELECT * FROM facts WHERE id = ? AND user_id = ?").get(id, userId) as Row | undefined;
    if (!r) throw new NotFound("Fact not found");
    return toFact(r);
  }

  updateFact(userId: string, id: string, patch: Partial<z.output<typeof factInput>>): Fact {
    const f = this.getFact(userId, id);
    this.db
      .prepare("UPDATE facts SET type = ?, text = ?, private = ? WHERE id = ? AND user_id = ?")
      .run(patch.type ?? f.type, patch.text ?? f.text, (patch.private ?? f.private) ? 1 : 0, id, userId);
    return this.getFact(userId, id);
  }

  deleteFact(userId: string, id: string) {
    this.getFact(userId, id);
    this.db.prepare("DELETE FROM facts WHERE id = ? AND user_id = ?").run(id, userId);
  }

  // ------------------------------------------------------------ key dates

  insertKeyDate(userId: string, contactId: string, d: z.output<typeof keyDateInput>): KeyDate {
    const id = newId();
    this.db
      .prepare(
        "INSERT INTO key_dates (id, user_id, contact_id, label, custom_label, month, day, year, repeats_yearly, reminder_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(id, userId, contactId, d.label, d.customLabel, d.month, d.day, d.year, d.repeatsYearly ? 1 : 0, d.reminderDays);
    return this.getKeyDate(userId, id);
  }

  addKeyDate(userId: string, contactId: string, d: z.output<typeof keyDateInput>): KeyDate {
    this.assertContact(userId, contactId);
    return this.insertKeyDate(userId, contactId, d);
  }

  getKeyDate(userId: string, id: string): KeyDate {
    const r = this.db.prepare("SELECT * FROM key_dates WHERE id = ? AND user_id = ?").get(id, userId) as Row | undefined;
    if (!r) throw new NotFound("Date not found");
    return toKeyDate(r);
  }

  replaceKeyDate(userId: string, id: string, d: z.output<typeof keyDateInput>): KeyDate {
    this.getKeyDate(userId, id);
    this.db
      .prepare(
        "UPDATE key_dates SET label = ?, custom_label = ?, month = ?, day = ?, year = ?, repeats_yearly = ?, reminder_days = ?, last_notified_for = NULL WHERE id = ? AND user_id = ?",
      )
      .run(d.label, d.customLabel, d.month, d.day, d.year, d.repeatsYearly ? 1 : 0, d.reminderDays, id, userId);
    return this.getKeyDate(userId, id);
  }

  deleteKeyDate(userId: string, id: string) {
    this.getKeyDate(userId, id);
    this.db.prepare("DELETE FROM key_dates WHERE id = ? AND user_id = ?").run(id, userId);
  }

  /** For the reminder scheduler: every date with a reminder, across users. */
  reminderCandidates(): (KeyDate & { userId: string; contactName: string; lastNotifiedFor: string | null })[] {
    const rows = this.db
      .prepare(
        "SELECT k.*, COALESCE(c.nickname, c.name) AS contact_name FROM key_dates k JOIN contacts c ON c.id = k.contact_id WHERE k.reminder_days IS NOT NULL",
      )
      .all() as Row[];
    return rows.map((r) => ({ ...toKeyDate(r), userId: String(r.user_id), contactName: String(r.contact_name), lastNotifiedFor: s(r.last_notified_for) }));
  }

  markNotified(id: string, occurrence: string) {
    this.db.prepare("UPDATE key_dates SET last_notified_for = ? WHERE id = ?").run(occurrence, id);
  }

  // --------------------------------------------------------- interactions

  getInteraction(userId: string, id: string): Interaction {
    const r = this.db.prepare("SELECT * FROM interactions WHERE id = ? AND user_id = ?").get(id, userId) as Row | undefined;
    if (!r) throw new NotFound("Entry not found");
    const linked = (this.db.prepare("SELECT fact_id FROM interaction_facts WHERE interaction_id = ?").all(id) as Row[]).map((x) => String(x.fact_id));
    return toInteraction(r, linked);
  }

  addInteraction(
    userId: string,
    contactId: string,
    i: { date: string; kind: "capture" | "note"; summary: string; private: boolean; linkedFactIds?: string[] },
  ): Interaction {
    this.assertContact(userId, contactId);
    const id = newId();
    this.db
      .prepare("INSERT INTO interactions (id, user_id, contact_id, date, kind, summary, private, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, userId, contactId, i.date, i.kind, i.summary, i.private ? 1 : 0, nowIso());
    for (const fid of i.linkedFactIds ?? []) {
      this.db.prepare("INSERT OR IGNORE INTO interaction_facts (interaction_id, fact_id) VALUES (?, ?)").run(id, fid);
    }
    this.touchContact(userId, contactId, i.date);
    return this.getInteraction(userId, id);
  }

  updateInteraction(userId: string, id: string, patch: { summary?: string; date?: string; private?: boolean }): Interaction {
    const cur = this.getInteraction(userId, id);
    this.db
      .prepare("UPDATE interactions SET summary = ?, date = ?, private = ? WHERE id = ? AND user_id = ?")
      .run(patch.summary ?? cur.summary, patch.date ?? cur.date, (patch.private ?? cur.private) ? 1 : 0, id, userId);
    return this.getInteraction(userId, id);
  }

  deleteInteraction(userId: string, id: string) {
    this.getInteraction(userId, id);
    this.db.prepare("DELETE FROM interactions WHERE id = ? AND user_id = ?").run(id, userId);
  }

  // ------------------------------------------------------- groups & tags

  listGroups(userId: string): Group[] {
    return (this.db.prepare("SELECT * FROM groups WHERE user_id = ? ORDER BY position, name COLLATE NOCASE").all(userId) as Row[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      color: r.color as Color,
    }));
  }

  createGroup(userId: string, g: { name: string; color: Color }): Group {
    const id = newId();
    const pos = (this.db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM groups WHERE user_id = ?").get(userId) as Row).p;
    this.db.prepare("INSERT INTO groups (id, user_id, name, color, position) VALUES (?, ?, ?, ?, ?)").run(id, userId, g.name, g.color, Number(pos));
    return { id, ...g };
  }

  updateGroup(userId: string, id: string, g: { name?: string; color?: Color }): Group {
    const cur = this.listGroups(userId).find((x) => x.id === id);
    if (!cur) throw new NotFound("Group not found");
    const next = { ...cur, ...Object.fromEntries(Object.entries(g).filter(([, v]) => v !== undefined)) };
    this.db.prepare("UPDATE groups SET name = ?, color = ? WHERE id = ? AND user_id = ?").run(next.name, next.color, id, userId);
    return next;
  }

  deleteGroup(userId: string, id: string) {
    const r = this.db.prepare("DELETE FROM groups WHERE id = ? AND user_id = ?").run(id, userId);
    if (r.changes === 0) throw new NotFound("Group not found");
  }

  listTags(userId: string): Tag[] {
    return (this.db.prepare("SELECT * FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE").all(userId) as Row[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
    }));
  }

  renameTag(userId: string, id: string, name: string): Tag {
    const clash = this.db.prepare("SELECT id FROM tags WHERE user_id = ? AND lower(name) = lower(?) AND id != ?").get(userId, name, id) as Row | undefined;
    if (clash) {
      // Merge into the existing tag.
      this.db.prepare("INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) SELECT contact_id, ? FROM contact_tags WHERE tag_id = ?").run(String(clash.id), id);
      this.deleteTag(userId, id);
      return { id: String(clash.id), name };
    }
    const r = this.db.prepare("UPDATE tags SET name = ? WHERE id = ? AND user_id = ?").run(name, id, userId);
    if (r.changes === 0) throw new NotFound("Tag not found");
    return { id, name };
  }

  deleteTag(userId: string, id: string) {
    const r = this.db.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(id, userId);
    if (r.changes === 0) throw new NotFound("Tag not found");
  }

  // --------------------------------------------------------- data control

  exportAll(userId: string) {
    const contacts = this.listContacts(userId).map((c) => this.getContact(userId, c.id));
    return { contacts, groups: this.listGroups(userId), tags: this.listTags(userId) };
  }

  /** Delete every record the user owns, keeping only the account so they stay signed in. */
  deleteEverything(userId: string) {
    transaction(this.db, () => {
      for (const table of ["contacts", "groups", "tags", "push_subscriptions", "ai_usage"]) {
        this.db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
      }
    });
  }
}
