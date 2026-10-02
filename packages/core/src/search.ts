import type { ContactSummary, Group, Tag } from "./models";

export interface ContactFilter {
  query?: string;
  groupId?: string | null;
  tagId?: string | null;
}

export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Text a contact can be found by: name, details, facts (private ones excluded), tags and groups. */
function haystack(c: ContactSummary, tags: Map<string, Tag>, groups: Map<string, Group>): string {
  const parts = [
    c.name,
    c.nickname,
    c.howWeKnow,
    c.phone,
    c.email,
    c.address,
    c.notes,
    ...c.socials.map((s) => `${s.network} ${s.handle}`),
    ...c.facts.filter((f) => !f.private).map((f) => f.text),
    ...c.tagIds.map((id) => tags.get(id)?.name),
    ...c.groupIds.map((id) => groups.get(id)?.name),
  ];
  return normalize(parts.filter(Boolean).join(" \u0001 "));
}

export interface SearchResult {
  contact: ContactSummary;
  /** Where the query matched, when it was not the name. Shown under the row. */
  matchedOn: string | null;
}

/**
 * Filter and rank contacts. Every word in the query must appear somewhere.
 * Name matches rank first, then by name.
 */
export function searchContacts(
  contacts: ContactSummary[],
  filter: ContactFilter,
  tagList: Tag[] = [],
  groupList: Group[] = [],
): SearchResult[] {
  const tags = new Map(tagList.map((t) => [t.id, t]));
  const groups = new Map(groupList.map((g) => [g.id, g]));
  const words = normalize(filter.query ?? "").split(" ").filter(Boolean);

  const results: (SearchResult & { score: number })[] = [];
  for (const c of contacts) {
    if (filter.groupId && !c.groupIds.includes(filter.groupId)) continue;
    if (filter.tagId && !c.tagIds.includes(filter.tagId)) continue;
    if (words.length === 0) {
      results.push({ contact: c, matchedOn: null, score: 0 });
      continue;
    }
    const hay = haystack(c, tags, groups);
    if (!words.every((w) => hay.includes(w))) continue;
    const name = normalize(`${c.name} ${c.nickname ?? ""}`);
    const nameHit = words.every((w) => name.includes(w));
    const startsWith = name.startsWith(words[0]!);
    let matchedOn: string | null = null;
    if (!nameHit) {
      const fact = c.facts.find((f) => !f.private && words.some((w) => normalize(f.text).includes(w)));
      matchedOn = fact ? fact.text : null;
    }
    results.push({ contact: c, matchedOn, score: (nameHit ? 2 : 0) + (startsWith ? 1 : 0) });
  }
  return results
    .sort((a, b) => b.score - a.score || a.contact.name.localeCompare(b.contact.name))
    .map(({ contact, matchedOn }) => ({ contact, matchedOn }));
}
