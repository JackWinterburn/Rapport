import { z } from "zod";

/**
 * Domain models shared by the server, the web app and a future React Native app.
 * Nothing in this package may import from the DOM or from Node.
 */

export const FACT_TYPES = ["interest", "habit", "preference", "giftIdea", "other"] as const;
export type FactType = (typeof FACT_TYPES)[number];

export const FACT_TYPE_LABELS: Record<FactType, string> = {
  interest: "Interests",
  habit: "Habits",
  preference: "Preferences",
  giftIdea: "Gift ideas",
  other: "Other details",
};

export const FACT_SOURCES = ["manual", "ai"] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

export const KEY_DATE_LABELS = ["birthday", "anniversary", "other"] as const;
export type KeyDateLabel = (typeof KEY_DATE_LABELS)[number];

export const INTERACTION_KINDS = ["capture", "note"] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

/** Notion's tag palette. Used for groups, tags and generated avatars. */
export const COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;
export type Color = (typeof COLORS)[number];

export interface SocialHandle {
  network: string;
  handle: string;
}

export interface Contact {
  id: string;
  name: string;
  nickname: string | null;
  photo: string | null;
  avatarColor: Color;
  howWeKnow: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  socials: SocialHandle[];
  notes: string | null;
  lastInteracted: string | null; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

export interface Fact {
  id: string;
  contactId: string;
  type: FactType;
  text: string;
  source: FactSource;
  private: boolean;
  createdAt: string;
}

export interface KeyDate {
  id: string;
  contactId: string;
  label: KeyDateLabel;
  customLabel: string | null;
  month: number; // 1-12
  day: number; // 1-31
  year: number | null;
  repeatsYearly: boolean;
  /** Days before the date to remind. null = no reminder. */
  reminderDays: number | null;
}

export interface Group {
  id: string;
  name: string;
  color: Color;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Interaction {
  id: string;
  contactId: string;
  date: string; // YYYY-MM-DD
  kind: InteractionKind;
  summary: string;
  private: boolean;
  linkedFactIds: string[];
  createdAt: string;
}

/** A contact with everything needed for the list, search and upcoming views (works offline). */
export interface ContactSummary extends Contact {
  groupIds: string[];
  tagIds: string[];
  facts: Fact[];
  keyDates: KeyDate[];
}

export interface ContactDetail extends ContactSummary {
  interactions: Interaction[];
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

// ---------------------------------------------------------------------------
// Validation for writes. The server validates every request body with these.
// ---------------------------------------------------------------------------

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Data URL for a client-resized photo. Capped so a bad client cannot bloat the DB. */
const photo = z
  .string()
  .max(1_500_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,/, "Photo must be an image data URL")
  .nullish()
  .transform((v) => v ?? null);

export const socialHandleSchema = z.object({
  network: trimmed(40).min(1),
  handle: trimmed(200).min(1),
});

export const keyDateInput = z
  .object({
    label: z.enum(KEY_DATE_LABELS),
    customLabel: optionalText(60),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    year: z.number().int().min(1900).max(2200).nullish().transform((v) => v ?? null),
    repeatsYearly: z.boolean().default(true),
    reminderDays: z.number().int().min(0).max(60).nullish().transform((v) => v ?? null),
  })
  .refine((d) => d.day <= daysInMonth(d.month, d.year ?? 2000), { message: "Invalid day for month", path: ["day"] })
  .refine((d) => d.repeatsYearly || d.year !== null, { message: "One-off dates need a year", path: ["year"] });
export type KeyDateInput = z.input<typeof keyDateInput>;

export const factInput = z.object({
  type: z.enum(FACT_TYPES),
  text: trimmed(500).min(1, "Required"),
  private: z.boolean().default(false),
});
export type FactInput = z.input<typeof factInput>;

export const contactInput = z.object({
  name: trimmed(120).min(1, "Name is required"),
  nickname: optionalText(80),
  photo,
  avatarColor: z.enum(COLORS).optional(),
  howWeKnow: optionalText(200),
  phone: optionalText(60),
  email: optionalText(200),
  address: optionalText(500),
  socials: z.array(socialHandleSchema).max(20).default([]),
  notes: optionalText(20_000),
  lastInteracted: isoDay.nullish().transform((v) => v ?? null),
  groupIds: z.array(z.string()).max(50).default([]),
  tagNames: z.array(trimmed(40).min(1)).max(50).default([]),
  facts: z.array(factInput).max(200).default([]),
  keyDates: z.array(keyDateInput).max(50).default([]),
});
export type ContactInput = z.input<typeof contactInput>;

/** Partial update. Facts and key dates are edited through their own endpoints. */
export const contactPatch = contactInput.omit({ facts: true, keyDates: true }).partial();
export type ContactPatch = z.input<typeof contactPatch>;

export const factPatch = factInput.partial();
export type FactPatch = z.input<typeof factPatch>;

export const groupInput = z.object({
  name: trimmed(40).min(1),
  color: z.enum(COLORS).default("gray"),
});
export type GroupInput = z.input<typeof groupInput>;

export const tagPatch = z.object({ name: trimmed(40).min(1) });

export const noteInput = z.object({
  summary: trimmed(5000).min(1, "Write something first"),
  date: isoDay.optional(),
  private: z.boolean().default(false),
});
export type NoteInput = z.input<typeof noteInput>;
export const notePatch = noteInput.partial();

export function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function keyDateTitle(d: Pick<KeyDate, "label" | "customLabel">): string {
  if (d.customLabel) return d.customLabel;
  return d.label === "birthday" ? "Birthday" : d.label === "anniversary" ? "Anniversary" : "Key date";
}

/** Stable colour from a name, for generated avatars. */
export function colorForName(name: string): Color {
  // FNV-1a: spreads similar names across the palette better than a simple polynomial hash.
  let h = 0x811c9dc5;
  for (const ch of name.trim().toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  const palette = COLORS.filter((c) => c !== "gray");
  return palette[h % palette.length]!;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}
