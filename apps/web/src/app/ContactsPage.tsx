import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { BellRing, Download, Plus, UserPlus, Users, X } from "lucide-react";
import { nextOccurrence, relativeAgo, searchContacts, todayLocal, daysBetween, type ContactSummary, type Group } from "@rapport/core";
import { Avatar, Button, Callout, DateBadge, EmptyState, Fab, FilterChip, List, ListRow, PageHeader, SearchInput, Skeleton, Tag, useToast } from "../ui";
import { errorMessage, useContacts, useGroups, useTags } from "../lib/api";
import { currentPushSubscription, enablePush, pushSupported, useInstallPrompt } from "../lib/device";
import "./pages.css";

export function ContactsPage() {
  const { data: contacts, isPending, error } = useContacts();
  const { data: groups = [] } = useGroups();
  const { data: tags = [] } = useTags();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get("q") ?? "";
  const groupId = params.get("group");
  const tagId = params.get("tag");

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const results = useMemo(() => searchContacts(contacts ?? [], { query, groupId, tagId }, tags, groups), [contacts, query, groupId, tagId, tags, groups]);
  const activeGroup = groups.find((g) => g.id === groupId);
  const activeTag = tags.find((t) => t.id === tagId);
  const title = activeGroup?.name ?? (activeTag ? `#${activeTag.name}` : "Contacts");

  if (error) return <Callout tone="danger" title="Couldn't load contacts">{errorMessage(error)}</Callout>;

  const isEmpty = contacts && contacts.length === 0;

  return (
    <>
      <PageHeader
        title={title}
        actions={
          !isEmpty && (
            <Button variant="primary" icon={<Plus />} onClick={() => navigate("/contacts/new")} className="hide-mobile">
              Add contact
            </Button>
          )
        }
      />

      {isEmpty ? (
        <FirstRun />
      ) : (
        <>
          <div className="contacts-toolbar">
            <SearchInput value={query} onChange={(v) => setParam("q", v || null)} placeholder="Search names, interests, tags…" aria-label="Search contacts" />
            {(groups.length > 0 || tags.length > 0) && (
              <div className="chip-scroller" role="group" aria-label="Filter by group or tag">
                {groups.map((g) => (
                  <FilterChip key={g.id} color={g.color} selected={g.id === groupId} onClick={() => setParam("group", g.id === groupId ? null : g.id)}>
                    {g.name}
                  </FilterChip>
                ))}
                {tags.map((t) => (
                  <FilterChip key={t.id} selected={t.id === tagId} onClick={() => setParam("tag", t.id === tagId ? null : t.id)}>
                    #{t.name}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          {isPending ? (
            <ListSkeleton />
          ) : results.length === 0 ? (
            <EmptyState icon={<Users />} title="No matches" action={<Button onClick={() => setParams({}, { replace: true })} icon={<X />}>Clear filters</Button>}>
              Nobody matches {query ? <>“{query}”</> : "these filters"}. Try a different word, or search an interest like “climbing”.
            </EmptyState>
          ) : (
            <List label="Contacts">
              {results.map(({ contact, matchedOn }) => (
                <ContactRow key={contact.id} contact={contact} matchedOn={matchedOn} groups={groups} />
              ))}
            </List>
          )}
          <p className="list-footer">
            {results.length} of {contacts?.length ?? 0} contacts
          </p>
        </>
      )}

      <Fab label="Add contact" onClick={() => navigate("/contacts/new")}>
        <Plus />
      </Fab>
    </>
  );
}

function ContactRow({ contact, matchedOn, groups }: { contact: ContactSummary; matchedOn: string | null; groups: Group[] }) {
  const today = todayLocal();
  const soonest = contact.keyDates
    .map((kd) => ({ kd, next: nextOccurrence(kd, today) }))
    .filter((x) => x.next)
    .map((x) => ({ ...x, until: daysBetween(today, x.next!) }))
    .sort((a, b) => a.until - b.until)[0];
  const contactGroups = groups.filter((g) => contact.groupIds.includes(g.id));

  return (
    <ListRow
      to={`/contacts/${contact.id}`}
      leading={<Avatar name={contact.name} photo={contact.photo} color={contact.avatarColor} size="md" />}
      title={
        <>
          {contact.name}
          {contact.nickname && <span className="text-tertiary"> · {contact.nickname}</span>}
        </>
      }
      description={matchedOn ? <>Matches: {matchedOn}</> : contact.howWeKnow}
      meta={
        (contactGroups.length > 0 || (soonest && soonest.until <= 30) || contact.lastInteracted) && (
          <>
            {soonest && soonest.until <= 30 && <DateBadge daysUntil={soonest.until} date={soonest.next!} suffix={soonest.kd.label === "birthday" ? "Birthday" : undefined} />}
            {contactGroups.map((g) => (
              <Tag key={g.id} color={g.color} size="sm">
                {g.name}
              </Tag>
            ))}
            {contact.lastInteracted && <span>Last spoke {relativeAgo(contact.lastInteracted, today).toLowerCase()}</span>}
          </>
        )
      }
    />
  );
}

function ListSkeleton() {
  return (
    <div className="stack" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="row skeleton-row">
          <Skeleton width={36} height={36} radius={18} />
          <div className="stack" style={{ gap: 6, flex: 1 }}>
            <Skeleton width={`${40 + ((i * 17) % 30)}%`} />
            <Skeleton width="25%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** User flow 1: first run. Offer install + notifications, then the first contact. */
function FirstRun() {
  const navigate = useNavigate();
  const toast = useToast();
  const install = useInstallPrompt();
  const [pushOn, setPushOn] = useState<boolean | null>(null);

  useEffect(() => {
    if (pushSupported()) void currentPushSubscription().then((s) => setPushOn(Boolean(s)));
  }, []);

  return (
    <div className="first-run">
      <EmptyState
        icon={<UserPlus />}
        title="Add your first contact"
        action={
          <Button variant="primary" size="lg" icon={<Plus />} onClick={() => navigate("/contacts/new")}>
            Add your first contact
          </Button>
        }
      >
        Only a name is required. Interests, birthdays and gift ideas can come later, or straight from a conversation you log.
      </EmptyState>

      <div className="first-run__setup">
        {!install.installed && (
          <Callout
            icon={<Download />}
            title="Install Rapport"
            action={
              install.canPrompt ? (
                <Button size="sm" onClick={install.prompt}>
                  Install app
                </Button>
              ) : undefined
            }
          >
            {install.canPrompt
              ? "Add it to your home screen so it opens like an app and works offline."
              : "On iPhone: tap Share, then Add to Home Screen. Notifications on iPhone need this."}
          </Callout>
        )}
        {pushSupported() && !pushOn && (
          <Callout
            icon={<BellRing />}
            title="Birthday reminders"
            action={
              <Button
                size="sm"
                onClick={() =>
                  enablePush()
                    .then(() => {
                      setPushOn(true);
                      toast.success("Notifications are on");
                    })
                    .catch((e) => toast.error(errorMessage(e)))
                }
              >
                Allow notifications
              </Button>
            }
          >
            Get a nudge a week before birthdays, with time to buy a gift.
          </Callout>
        )}
      </div>
    </div>
  );
}
