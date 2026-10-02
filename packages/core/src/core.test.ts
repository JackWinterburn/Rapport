import { describe, expect, it } from "vitest";
import {
  contactInput,
  contactsToCsv,
  initials,
  isGrounded,
  isReminderDue,
  isSensitive,
  keyDateInput,
  nextOccurrence,
  sanitizeSuggestions,
  searchContacts,
  upcomingDates,
  type ContactSummary,
  type KeyDate,
} from "./index";

const kd = (over: Partial<KeyDate> = {}): KeyDate => ({
  id: "k1",
  contactId: "c1",
  label: "birthday",
  customLabel: null,
  month: 3,
  day: 10,
  year: 1990,
  repeatsYearly: true,
  reminderDays: 7,
  ...over,
});

const contact = (over: Partial<ContactSummary> = {}): ContactSummary => ({
  id: "c1",
  name: "Ada Lovelace",
  nickname: null,
  photo: null,
  avatarColor: "blue",
  howWeKnow: "Work",
  phone: null,
  email: null,
  address: null,
  socials: [],
  notes: null,
  lastInteracted: null,
  createdAt: "",
  updatedAt: "",
  groupIds: [],
  tagIds: [],
  facts: [],
  keyDates: [],
  ...over,
});

describe("dates", () => {
  it("finds the next occurrence this year or next", () => {
    expect(nextOccurrence(kd(), { year: 2026, month: 3, day: 1 })).toEqual({ year: 2026, month: 3, day: 10 });
    expect(nextOccurrence(kd(), { year: 2026, month: 3, day: 10 })).toEqual({ year: 2026, month: 3, day: 10 });
    expect(nextOccurrence(kd(), { year: 2026, month: 3, day: 11 })).toEqual({ year: 2027, month: 3, day: 10 });
  });

  it("moves 29 Feb to 28 Feb in non-leap years", () => {
    expect(nextOccurrence(kd({ month: 2, day: 29 }), { year: 2026, month: 1, day: 1 })).toEqual({ year: 2026, month: 2, day: 28 });
    expect(nextOccurrence(kd({ month: 2, day: 29 }), { year: 2028, month: 1, day: 1 })).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it("drops one-off dates that have passed", () => {
    const once = kd({ repeatsYearly: false, year: 2026, month: 5, day: 1 });
    expect(nextOccurrence(once, { year: 2026, month: 4, day: 1 })).toEqual({ year: 2026, month: 5, day: 1 });
    expect(nextOccurrence(once, { year: 2026, month: 5, day: 2 })).toBeNull();
  });

  it("flags reminders inside the lead time", () => {
    expect(isReminderDue(kd(), { year: 2026, month: 3, day: 3 })).toBe(true);
    expect(isReminderDue(kd(), { year: 2026, month: 3, day: 2 })).toBe(false);
    expect(isReminderDue(kd({ reminderDays: null }), { year: 2026, month: 3, day: 9 })).toBe(false);
  });

  it("sorts upcoming dates soonest first and computes age", () => {
    const items = upcomingDates(
      [
        contact({ id: "a", name: "A", keyDates: [kd({ month: 12, day: 1 })] }),
        contact({ id: "b", name: "B", keyDates: [kd({ month: 10, day: 5 })] }),
      ],
      { year: 2026, month: 10, day: 2 },
    );
    expect(items.map((i) => i.contactId)).toEqual(["b", "a"]);
    expect(items[0]).toMatchObject({ daysUntil: 3, years: 36, reminderDue: true, date: "2026-10-05" });
  });
});

describe("validation", () => {
  it("requires only a name", () => {
    const r = contactInput.parse({ name: "  Sam " });
    expect(r.name).toBe("Sam");
    expect(r.nickname).toBeNull();
    expect(contactInput.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects impossible dates and one-off dates without a year", () => {
    expect(keyDateInput.safeParse({ label: "birthday", month: 2, day: 30 }).success).toBe(false);
    expect(keyDateInput.safeParse({ label: "other", month: 2, day: 3, repeatsYearly: false }).success).toBe(false);
    expect(keyDateInput.safeParse({ label: "birthday", month: 2, day: 29 }).success).toBe(true);
  });

  it("makes initials", () => {
    expect(initials("ada king lovelace")).toBe("AL");
    expect(initials("Cher")).toBe("C");
  });
});

describe("search", () => {
  const people = [
    contact({ id: "1", name: "Sam Climber", facts: [{ id: "f", contactId: "1", type: "interest", text: "Bouldering", source: "manual", private: false, createdAt: "" }] }),
    contact({ id: "2", name: "Alex", tagIds: ["t1"], facts: [{ id: "g", contactId: "2", type: "interest", text: "Secret climbing", source: "manual", private: true, createdAt: "" }] }),
  ];

  it("matches names and facts, ranking names first", () => {
    expect(searchContacts(people, { query: "boulder" }).map((r) => r.contact.id)).toEqual(["1"]);
    expect(searchContacts(people, { query: "boulder" })[0]!.matchedOn).toBe("Bouldering");
  });

  it("ignores private facts and filters by tag", () => {
    expect(searchContacts(people, { query: "secret" })).toHaveLength(0);
    expect(searchContacts(people, { tagId: "t1" }).map((r) => r.contact.id)).toEqual(["2"]);
    expect(searchContacts(people, { query: "climbing" }, [{ id: "t1", name: "climbing" }]).map((r) => r.contact.id)).toEqual(["2"]);
  });
});

describe("AI suggestion guards", () => {
  const source = "Had coffee with Priya. She's training for the Berlin marathon and wants a new Garmin watch. Her birthday is 14 June. She's been in hospital recently.";
  let n = 0;
  const id = () => `id${n++}`;

  it("keeps grounded suggestions and maps types", () => {
    const out = sanitizeSuggestions(
      {
        summary: "Coffee with Priya; marathon training.",
        suggestions: [
          { type: "interest", text: "Marathon running", evidence: "training for the Berlin marathon" },
          { type: "giftIdea", text: "Garmin watch", evidence: "wants a new Garmin watch" },
          { type: "keyDate", text: "Birthday", evidence: "Her birthday is 14 June", dateLabel: "birthday", month: 6, day: 14 },
          { type: "followUp", text: "ask how the marathon went", evidence: "Berlin marathon" },
        ],
      },
      source,
      [],
      id,
    );
    expect(out.suggestions.map((s) => s.kind)).toEqual(["fact", "fact", "keyDate", "fact"]);
    expect(out.suggestions[2]).toMatchObject({ kind: "keyDate", label: "birthday", month: 6, day: 14, year: null });
    expect(out.suggestions[3]).toMatchObject({ factType: "other", text: "Follow up: ask how the marathon went" });
  });

  it("drops invented, sensitive, duplicate and malformed items", () => {
    const out = sanitizeSuggestions(
      {
        summary: "x",
        suggestions: [
          { type: "interest", text: "Loves jazz", evidence: "she loves jazz music" },
          { type: "other", text: "Recently in hospital", evidence: "She's been in hospital recently" },
          { type: "giftIdea", text: "Garmin watch", evidence: "wants a new Garmin watch" },
          { type: "keyDate", text: "Birthday", evidence: "Her birthday is 14 June", month: 2, day: 31 },
          { type: "weird", text: "?", evidence: "Priya" },
        ],
      },
      source,
      [{ type: "giftIdea", text: "garmin watch" }],
      id,
    );
    expect(out.suggestions).toHaveLength(0);
    expect(out.dropped).toEqual({ ungrounded: 1, sensitive: 1, duplicate: 1, invalid: 2 });
  });

  it("detects sensitivity and grounding", () => {
    expect(isSensitive("Going through a divorce")).toBe(true);
    expect(isSensitive("Loves bouldering")).toBe(false);
    expect(isGrounded("training for the Berlin marathon!", source)).toBe(true);
    expect(isGrounded("plays the cello", source)).toBe(false);
  });

  it("survives garbage model output", () => {
    expect(sanitizeSuggestions("nope", source, []).suggestions).toEqual([]);
  });
});

describe("export", () => {
  it("escapes CSV cells", () => {
    const csv = contactsToCsv({
      contacts: [{ ...contact({ name: 'Ann "AJ", Jr', notes: "line1\nline2" }), interactions: [] }],
      groups: [],
      tags: [],
    });
    expect(csv).toContain('"Ann ""AJ"", Jr"');
    expect(csv).toContain('"line1\nline2"');
  });
});
