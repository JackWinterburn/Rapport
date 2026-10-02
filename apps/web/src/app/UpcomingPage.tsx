import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Bell, BellRing, CalendarDays, Gift } from "lucide-react";
import { parseIsoDay, todayLocal, upcomingBucket, upcomingDates, weekday, formatDay, type UpcomingItem } from "@rapport/core";
import { Avatar, Button, Callout, DateBadge, EmptyState, List, ListRow, PageHeader, Section, Skeleton, useToast } from "../ui";
import { errorMessage, useContacts } from "../lib/api";
import { currentPushSubscription, enablePush, pushSupported } from "../lib/device";
import "./pages.css";

const BUCKETS = ["Today", "This week", "Next 30 days", "Later"] as const;

/** User flow 4: upcoming birthdays and key dates, soonest first, grouped like Todoist's Upcoming view. */
export function UpcomingPage() {
  const { data: contacts, isPending } = useContacts();
  const items = useMemo(() => upcomingDates(contacts ?? [], todayLocal()), [contacts]);
  const byId = useMemo(() => new Map((contacts ?? []).map((c) => [c.id, c])), [contacts]);
  const due = items.filter((i) => i.reminderDue);
  const today = todayLocal();

  return (
    <>
      <PageHeader title="Upcoming" subtitle={`${weekday(today)} ${formatDay(today, { withYear: true })}`} />
      <NotificationNudge />

      {isPending ? (
        <div className="stack" style={{ gap: 12 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} width="70%" height={18} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="No dates yet" action={<Link to="/" className="ui-btn ui-btn--secondary ui-btn--md">Go to contacts</Link>}>
          Add birthdays and anniversaries to contacts and they'll show up here, soonest first.
        </EmptyState>
      ) : (
        <>
          {due.length > 0 && (
            <p className="due-summary">
              <BellRing className="inline-icon inline-icon--accent" aria-hidden />
              {due.length} {due.length === 1 ? "reminder is" : "reminders are"} due. Open a profile for gift ideas and notes.
            </p>
          )}
          {BUCKETS.map((bucket) => {
            const inBucket = items.filter((i) => upcomingBucket(i.daysUntil) === bucket);
            if (inBucket.length === 0) return null;
            return (
              <Section key={bucket} title={bucket} count={inBucket.length} collapsible defaultOpen={bucket !== "Later"}>
                <List label={bucket}>
                  {inBucket.map((item) => (
                    <UpcomingRow key={item.keyDate.id} item={item} contact={byId.get(item.contactId)} />
                  ))}
                </List>
              </Section>
            );
          })}
        </>
      )}
    </>
  );
}

function UpcomingRow({ item, contact }: { item: UpcomingItem; contact?: import("@rapport/core").ContactSummary }) {
  const gifts = contact?.facts.filter((f) => f.type === "giftIdea" && !f.private).length ?? 0;
  const detail =
    item.years !== null ? (item.keyDate.label === "birthday" ? `Turns ${item.years}` : `${item.years} ${item.years === 1 ? "year" : "years"}`) : undefined;
  return (
    <ListRow
      to={`/contacts/${item.contactId}`}
      leading={contact && <Avatar name={contact.name} photo={contact.photo} color={contact.avatarColor} size="sm" />}
      title={`${item.contactName}'s ${item.title.toLowerCase()}`}
      meta={
        <>
          <DateBadge daysUntil={item.daysUntil} date={parseIsoDay(item.date)} suffix={detail} />
          {item.keyDate.reminderDays !== null && (
            <span className="row" style={{ gap: 4 }} title={item.reminderDue ? "Reminder due" : "Reminder set"}>
              {item.reminderDue ? <BellRing className="inline-icon inline-icon--accent" aria-label="Reminder due" /> : <Bell className="inline-icon" aria-label="Reminder set" />}
            </span>
          )}
        </>
      }
      trailing={
        gifts > 0 && (
          <span className="row" style={{ gap: 4 }} title={`${gifts} gift ideas`}>
            <Gift className="inline-icon" aria-hidden /> {gifts}
          </span>
        )
      }
    />
  );
}

function NotificationNudge() {
  const toast = useToast();
  const [state, setState] = useState<"unknown" | "on" | "off">("unknown");
  useEffect(() => {
    if (!pushSupported()) return;
    void currentPushSubscription().then((s) => setState(s ? "on" : "off"));
  }, []);
  if (state !== "off" || sessionStorageGet("dismiss-push-nudge")) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <Callout
        icon={<BellRing />}
        tone="accent"
        title="Get reminded before the day"
        action={
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                enablePush()
                  .then(() => {
                    setState("on");
                    toast.success("Notifications are on");
                  })
                  .catch((e) => toast.error(errorMessage(e)))
              }
            >
              Turn on notifications
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                sessionStorageSet("dismiss-push-nudge");
                setState("unknown");
              }}
            >
              Not now
            </Button>
          </>
        }
      >
        Reminders arrive at the lead time you set on each date. Without notifications they still show here.
      </Callout>
    </div>
  );
}

function sessionStorageGet(k: string) {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
function sessionStorageSet(k: string) {
  try {
    sessionStorage.setItem(k, "1");
  } catch {
    /* ignore */
  }
}
