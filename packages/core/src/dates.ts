import { daysInMonth, keyDateTitle, type ContactSummary, type KeyDate } from "./models";

/** A calendar day with no time zone. Months are 1-12. */
export interface SimpleDate {
  year: number;
  month: number;
  day: number;
}

export function todayLocal(now: Date = new Date()): SimpleDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function toIsoDay(d: SimpleDate): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

export function parseIsoDay(s: string): SimpleDate {
  const [y, m, d] = s.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

/** Days since 1970-01-01 for a calendar day; safe for differences. */
export function dayNumber(d: SimpleDate): number {
  return Math.round(Date.UTC(d.year, d.month - 1, d.day) / 86_400_000);
}

export function daysBetween(from: SimpleDate, to: SimpleDate): number {
  return dayNumber(to) - dayNumber(from);
}

export function addDays(d: SimpleDate, n: number): SimpleDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** The date in a given year, moving 29 Feb to 28 Feb in non-leap years. */
function inYear(month: number, day: number, year: number): SimpleDate {
  return { year, month, day: Math.min(day, daysInMonth(month, year)) };
}

/** Next occurrence on or after `today`, or null if a one-off date has passed. */
export function nextOccurrence(kd: Pick<KeyDate, "month" | "day" | "year" | "repeatsYearly">, today: SimpleDate): SimpleDate | null {
  if (!kd.repeatsYearly) {
    if (kd.year === null) return null;
    const d = inYear(kd.month, kd.day, kd.year);
    return daysBetween(today, d) >= 0 ? d : null;
  }
  const thisYear = inYear(kd.month, kd.day, today.year);
  return daysBetween(today, thisYear) >= 0 ? thisYear : inYear(kd.month, kd.day, today.year + 1);
}

export function isReminderDue(kd: Pick<KeyDate, "month" | "day" | "year" | "repeatsYearly" | "reminderDays">, today: SimpleDate): boolean {
  if (kd.reminderDays === null) return false;
  const next = nextOccurrence(kd, today);
  if (!next) return false;
  const until = daysBetween(today, next);
  return until >= 0 && until <= kd.reminderDays;
}

export interface UpcomingItem {
  contactId: string;
  contactName: string;
  keyDate: KeyDate;
  title: string;
  date: string; // YYYY-MM-DD of the occurrence
  daysUntil: number;
  /** Age turned or years since, when the original year is known. */
  years: number | null;
  reminderDue: boolean;
}

export function upcomingDates(contacts: ContactSummary[], today: SimpleDate, horizonDays = 366): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const c of contacts) {
    for (const kd of c.keyDates) {
      const next = nextOccurrence(kd, today);
      if (!next) continue;
      const until = daysBetween(today, next);
      if (until > horizonDays) continue;
      items.push({
        contactId: c.id,
        contactName: c.nickname || c.name,
        keyDate: kd,
        title: keyDateTitle(kd),
        date: toIsoDay(next),
        daysUntil: until,
        years: kd.year !== null && kd.repeatsYearly ? next.year - kd.year : null,
        reminderDue: isReminderDue(kd, today),
      });
    }
  }
  return items.sort((a, b) => a.daysUntil - b.daysUntil || a.contactName.localeCompare(b.contactName));
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function weekday(d: SimpleDate): string {
  return WEEKDAYS[new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()]!;
}

export function formatDay(d: SimpleDate, opts: { withYear?: boolean } = {}): string {
  return `${d.day} ${MONTHS[d.month - 1]}${opts.withYear ? ` ${d.year}` : ""}`;
}

export function formatMonthDay(month: number, day: number, year?: number | null): string {
  return `${day} ${MONTHS[month - 1]}${year ? ` ${year}` : ""}`;
}

/** Todoist-style relative label: Today, Tomorrow, Friday, 12 Mar. */
export function relativeDayLabel(daysUntil: number, date: SimpleDate): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil === -1) return "Yesterday";
  if (daysUntil > 1 && daysUntil < 7) return weekday(date);
  return formatDay(date);
}

/** Bucket for grouping upcoming items into sections. */
export function upcomingBucket(daysUntil: number): "Today" | "This week" | "Next 30 days" | "Later" {
  if (daysUntil === 0) return "Today";
  if (daysUntil < 7) return "This week";
  if (daysUntil <= 30) return "Next 30 days";
  return "Later";
}

/** "3 days ago", "today", used for last-interacted. */
export function relativeAgo(isoDay: string, today: SimpleDate): string {
  const n = daysBetween(parseIsoDay(isoDay), today);
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  if (n < 365 * 2) return `${Math.round(n / 30)} months ago`;
  return `${Math.round(n / 365)} years ago`;
}
