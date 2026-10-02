import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AtSign,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  Clock,
  Hash,
  Handshake,
  Layers,
  Mail,
  MapPin,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import {
  FACT_TYPES,
  daysBetween,
  formatMonthDay,
  keyDateTitle,
  nextOccurrence,
  relativeAgo,
  todayLocal,
  toIsoDay,
  type ContactDetail,
  type KeyDate,
  type KeyDateInput,
} from "@rapport/core";
import { ApiError } from "@rapport/core";
import {
  Avatar,
  Button,
  Callout,
  ConfirmDialog,
  DateBadge,
  EmptyState,
  IconButton,
  Menu,
  PageHeader,
  Property,
  PropertyList,
  Section,
  Skeleton,
  Tag,
  TextArea,
  useToast,
} from "../ui";
import { api, errorMessage, useContact, useContactMutation, useGroups, useInvalidateContact, useTags } from "../lib/api";
import { FactSection } from "./components/Facts";
import { Timeline } from "./components/Timeline";
import { KeyDateDialog, REMINDER_OPTIONS } from "./components/KeyDateDialog";
import "./pages.css";

export function ContactPage() {
  const { id } = useParams();
  const { data: contact, error, isPending } = useContact(id);

  if (isPending) return <ProfileSkeleton />;
  if (error instanceof ApiError && error.status === 404)
    return (
      <EmptyState title="Contact not found" action={<Link to="/" className="ui-btn ui-btn--secondary ui-btn--md">Back to contacts</Link>}>
        It may have been deleted.
      </EmptyState>
    );
  if (error || !contact) return <Callout tone="danger" title="Couldn't load this contact">{errorMessage(error)}</Callout>;
  return <Profile contact={contact} />;
}

function Profile({ contact }: { contact: ContactDetail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateContact();
  const { data: groups = [] } = useGroups();
  const { data: tags = [] } = useTags();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dateDialog, setDateDialog] = useState<{ open: boolean; kd: KeyDate | null }>({ open: false, kd: null });
  const today = todayLocal();

  const del = useContactMutation(undefined, () => api.deleteContact(contact.id));
  const saveDate = useContactMutation(contact.id, (input: KeyDateInput) =>
    dateDialog.kd ? api.updateKeyDate(dateDialog.kd.id, input) : api.addKeyDate(contact.id, input),
  );
  const deleteDate = useContactMutation(contact.id, (kdId: string) => api.deleteKeyDate(kdId));
  const markSpoke = useContactMutation(contact.id, () => api.updateContact(contact.id, { lastInteracted: toIsoDay(today) }));

  const contactGroups = groups.filter((g) => contact.groupIds.includes(g.id));
  const contactTags = tags.filter((t) => contact.tagIds.includes(t.id));

  return (
    <article className="profile">
      <nav className="profile__crumb" aria-label="Breadcrumb">
        <Link to="/" className="crumb-link">
          <ChevronLeft aria-hidden /> Contacts
        </Link>
      </nav>

      <div className="profile__hero">
        <Avatar name={contact.name} photo={contact.photo} color={contact.avatarColor} size="xl" />
      </div>
      <PageHeader
        size="page"
        title={contact.name}
        subtitle={contact.nickname ? `“${contact.nickname}”` : undefined}
        actions={
          <>
            <Button variant="primary" icon={<MessageSquarePlus />} onClick={() => navigate(`/capture?contact=${contact.id}`)} className="hide-mobile">
              Log conversation
            </Button>
            <Menu
              trigger={(p) => (
                <IconButton label="More actions" {...p}>
                  <MoreHorizontal />
                </IconButton>
              )}
              items={[
                { label: "Edit profile", icon: <Pencil />, onSelect: () => navigate(`/contacts/${contact.id}/edit`) },
                { label: "Add key date", icon: <CalendarPlus />, onSelect: () => setDateDialog({ open: true, kd: null }) },
                { label: "Spoke today", icon: <Clock />, onSelect: () => markSpoke.mutate(undefined, { onSuccess: () => toast.success("Marked as spoken today") }) },
                "separator",
                { label: "Delete contact", icon: <Trash2 />, danger: true, onSelect: () => setConfirmDelete(true) },
              ]}
            />
          </>
        }
      />

      <Button variant="primary" block size="lg" icon={<MessageSquarePlus />} className="show-mobile profile__log" onClick={() => navigate(`/capture?contact=${contact.id}`)}>
        Log conversation
      </Button>

      <PropertyList>
        <Property icon={<Handshake />} label="How we know">
          {contact.howWeKnow}
        </Property>
        <Property icon={<Layers />} label="Groups">
          {contactGroups.map((g) => (
            <Link key={g.id} to={`/?group=${g.id}`} className="tag-link">
              <Tag color={g.color}>{g.name}</Tag>
            </Link>
          ))}
        </Property>
        <Property icon={<Hash />} label="Tags">
          {contactTags.map((t) => (
            <Link key={t.id} to={`/?tag=${t.id}`} className="tag-link">
              <Tag>{t.name}</Tag>
            </Link>
          ))}
        </Property>
        <Property icon={<Clock />} label="Last spoke">
          {contact.lastInteracted ? relativeAgo(contact.lastInteracted, today) : null}
        </Property>
        {contact.phone && (
          <Property icon={<Phone />} label="Phone">
            <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>
          </Property>
        )}
        {contact.email && (
          <Property icon={<Mail />} label="Email">
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </Property>
        )}
        {contact.address && (
          <Property icon={<MapPin />} label="Address">
            <span style={{ whiteSpace: "pre-line" }}>{contact.address}</span>
          </Property>
        )}
        {contact.socials.map((s, i) => (
          <Property key={i} icon={<AtSign />} label={s.network}>
            {s.handle}
          </Property>
        ))}
      </PropertyList>

      <div className="profile__sections">
        <Section
          title="Key dates"
          count={contact.keyDates.length || undefined}
          action={
            <Button size="sm" variant="ghost" icon={<CalendarPlus />} onClick={() => setDateDialog({ open: true, kd: null })}>
              Add
            </Button>
          }
        >
          {contact.keyDates.length === 0 ? (
            <button type="button" className="add-row" onClick={() => setDateDialog({ open: true, kd: null })}>
              <span className="add-row__plus">
                <CalendarDays />
              </span>
              Add a birthday or anniversary
            </button>
          ) : (
            <ul className="date-list">
              {contact.keyDates.map((kd) => {
                const next = nextOccurrence(kd, today);
                const until = next ? daysBetween(today, next) : null;
                const years = next && kd.year && kd.repeatsYearly ? next.year - kd.year : null;
                const reminder = REMINDER_OPTIONS.find((o) => o.value === (kd.reminderDays === null ? "" : String(kd.reminderDays)))?.label;
                return (
                  <li key={kd.id} className="date-item">
                    <button type="button" className="date-item__main" onClick={() => setDateDialog({ open: true, kd })}>
                      <span className="date-item__title">{keyDateTitle(kd)}</span>
                      <span className="date-item__meta">
                        {formatMonthDay(kd.month, kd.day, kd.year)}
                        {years !== null && kd.label === "birthday" && ` · turns ${years}`}
                        {years !== null && kd.label !== "birthday" && ` · ${years} years`}
                        {reminder && kd.reminderDays !== null && ` · 🔔 ${reminder}`}
                      </span>
                    </button>
                    {next && until !== null && <DateBadge daysUntil={until} date={next} />}
                    <IconButton label={`Delete ${keyDateTitle(kd)}`} size="sm" onClick={() => deleteDate.mutate(kd.id, { onError: (e) => toast.error(errorMessage(e)) })}>
                      <Trash2 />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {FACT_TYPES.map((t) => (
          <FactSection key={t} contact={contact} type={t} />
        ))}

        <NotesBlock contact={contact} onSaved={(d) => invalidate(contact.id, d)} />

        <Timeline contact={contact} />
      </div>

      <KeyDateDialog
        open={dateDialog.open}
        initial={dateDialog.kd}
        saving={saveDate.isPending}
        onClose={() => setDateDialog({ open: false, kd: null })}
        onSave={(input) =>
          saveDate.mutate(input, {
            onSuccess: () => setDateDialog({ open: false, kd: null }),
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${contact.name}?`}
        confirmLabel="Delete contact"
        danger
        loading={del.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          del.mutate(undefined, {
            onSuccess: () => {
              toast.show(`${contact.name} deleted`);
              navigate("/", { replace: true });
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      >
        This removes their profile, key dates, details and timeline. It can't be undone. Export your data first if you want a copy.
      </ConfirmDialog>
    </article>
  );
}

/** Notion-style free-form text block that saves when you click away. */
function NotesBlock({ contact, onSaved }: { contact: ContactDetail; onSaved: (d: ContactDetail) => void }) {
  const [text, setText] = useState(contact.notes ?? "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useEffect(() => setText(contact.notes ?? ""), [contact.notes]);

  const save = async () => {
    if ((contact.notes ?? "") === text) return;
    setSaving(true);
    try {
      onSaved(await api.updateContact(contact.id, { notes: text || null }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Notes" action={saving ? <span className="text-xs text-tertiary">Saving…</span> : undefined}>
      <TextArea
        autoGrow
        className="notes-block"
        value={text}
        maxLength={20000}
        placeholder="Anything else worth remembering…"
        aria-label="Notes"
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
      />
    </Section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="stack" style={{ gap: 16 }} aria-busy>
      <Skeleton width={96} height={96} radius={48} />
      <Skeleton width="50%" height={36} />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} width="80%" />
      ))}
    </div>
  );
}
