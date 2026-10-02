import { CalendarDays } from "lucide-react";
import { relativeDayLabel, type SimpleDate } from "@rapport/core";
import "./list.css";

/** Todoist-coloured relative date: green today, orange tomorrow, purple this week, grey later, red overdue. */
export function DateBadge({ daysUntil, date, showIcon = true, suffix }: { daysUntil: number; date: SimpleDate; showIcon?: boolean; suffix?: string }) {
  const tone = daysUntil < 0 ? "overdue" : daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : daysUntil < 7 ? "week" : "later";
  return (
    <span className={`ui-date ui-date--${tone}`}>
      {showIcon && <CalendarDays aria-hidden />}
      {relativeDayLabel(daysUntil, date)}
      {suffix && <span className="ui-date__suffix"> · {suffix}</span>}
    </span>
  );
}
