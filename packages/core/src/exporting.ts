import { FACT_TYPES, FACT_TYPE_LABELS, keyDateTitle, type ContactDetail, type Group, type Tag } from "./models";
import { formatMonthDay } from "./dates";

export interface ExportBundle {
  format: "rapport-export";
  version: 1;
  exportedAt: string;
  contacts: ContactDetail[];
  groups: Group[];
  tags: Tag[];
}

function csvCell(v: string | null | undefined): string {
  const s = v ?? "";
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per contact, facts and dates flattened. Photos are left out of CSV. */
export function contactsToCsv(bundle: Pick<ExportBundle, "contacts" | "groups" | "tags">): string {
  const groups = new Map(bundle.groups.map((g) => [g.id, g.name]));
  const tags = new Map(bundle.tags.map((t) => [t.id, t.name]));
  const header = [
    "Name",
    "Nickname",
    "How we know each other",
    "Phone",
    "Email",
    "Address",
    "Socials",
    "Groups",
    "Tags",
    ...FACT_TYPES.map((t) => FACT_TYPE_LABELS[t]),
    "Key dates",
    "Notes",
    "Last interacted",
    "Timeline entries",
  ];
  const rows = bundle.contacts.map((c) => [
    c.name,
    c.nickname,
    c.howWeKnow,
    c.phone,
    c.email,
    c.address,
    c.socials.map((s) => `${s.network}: ${s.handle}`).join("; "),
    c.groupIds.map((id) => groups.get(id) ?? "").join("; "),
    c.tagIds.map((id) => tags.get(id) ?? "").join("; "),
    ...FACT_TYPES.map((t) =>
      c.facts
        .filter((f) => f.type === t)
        .map((f) => f.text)
        .join("; "),
    ),
    c.keyDates.map((d) => `${keyDateTitle(d)}: ${formatMonthDay(d.month, d.day, d.year)}`).join("; "),
    c.notes,
    c.lastInteracted,
    String(c.interactions.length),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
