import { useState } from "react";
import { Lock, MoreHorizontal, Pencil, Sparkles, StickyNote, Trash2 } from "lucide-react";
import { formatDay, parseIsoDay, todayLocal, toIsoDay, type ContactDetail, type Interaction } from "@rapport/core";
import { Button, Checkbox, ConfirmDialog, IconButton, Menu, Section, Tag, TextArea, useToast } from "../../ui";
import { api, errorMessage, useContactMutation } from "../../lib/api";

/** User feature 5: a dated timeline of captures and manual notes, with quick note entry. */
export function Timeline({ contact }: { contact: ContactDetail }) {
  return (
    <Section title="Timeline" count={contact.interactions.length || undefined}>
      <NoteComposer contactId={contact.id} />
      {contact.interactions.length === 0 ? (
        <p className="timeline-empty">No entries yet. Log a conversation or jot a note after you next speak.</p>
      ) : (
        <ol className="timeline">
          {contact.interactions.map((i) => (
            <TimelineEntry key={i.id} entry={i} contact={contact} />
          ))}
        </ol>
      )}
    </Section>
  );
}

function NoteComposer({ contactId }: { contactId: string }) {
  const [text, setText] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [date, setDate] = useState(toIsoDay(todayLocal()));
  const [focused, setFocused] = useState(false);
  const toast = useToast();
  const add = useContactMutation(contactId, () => api.addNote(contactId, { summary: text.trim(), private: isPrivate, date }));
  const expanded = focused || text.length > 0;

  return (
    <form
      className={["composer", expanded && "composer--expanded"].filter(Boolean).join(" ")}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        add.mutate(undefined, {
          onSuccess: () => {
            setText("");
            setPrivate(false);
            setFocused(false);
            toast.success("Note added");
          },
          onError: (err) => toast.error(errorMessage(err)),
        });
      }}
    >
      <TextArea
        autoGrow
        rows={expanded ? 3 : 1}
        value={text}
        maxLength={5000}
        placeholder="Add a quick note…"
        aria-label="Quick note"
        onFocus={() => setFocused(true)}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      {expanded && (
        <div className="composer__bar">
          <label className="composer__date">
            <span className="sr-only">Date</span>
            <input type="date" value={date} max={toIsoDay(todayLocal())} onChange={(e) => setDate(e.target.value || toIsoDay(todayLocal()))} />
          </label>
          <Checkbox checked={isPrivate} onChange={setPrivate} label="Private" />
          <span style={{ flex: 1 }} />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setText("");
              setFocused(false);
            }}
          >
            Cancel
          </Button>
          <Button size="sm" variant="primary" type="submit" disabled={!text.trim()} loading={add.isPending}>
            Add note
          </Button>
        </div>
      )}
    </form>
  );
}

function TimelineEntry({ entry, contact }: { entry: Interaction; contact: ContactDetail }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.summary);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const update = useContactMutation(contact.id, (patch: { summary?: string; private?: boolean }) => api.updateInteraction(entry.id, patch));
  const remove = useContactMutation(contact.id, () => api.deleteInteraction(entry.id));
  const linked = contact.facts.filter((f) => entry.linkedFactIds.includes(f.id));
  const date = parseIsoDay(entry.date);
  const thisYear = date.year === todayLocal().year;

  return (
    <li className="timeline__entry">
      <span className={`timeline__icon timeline__icon--${entry.kind}`} aria-hidden>
        {entry.kind === "capture" ? <Sparkles /> : <StickyNote />}
      </span>
      <div className="timeline__body">
        <div className="timeline__head">
          <time dateTime={entry.date} className="timeline__date">
            {formatDay(date, { withYear: !thisYear })}
          </time>
          <span className="timeline__kind">{entry.kind === "capture" ? "Conversation" : "Note"}</span>
          {entry.private && (
            <span className="timeline__kind" title="Private">
              <Lock aria-label="Private" className="inline-icon" />
            </span>
          )}
          <span className="timeline__actions">
            <Menu
              trigger={(p) => (
                <IconButton label="Entry options" size="sm" {...p}>
                  <MoreHorizontal />
                </IconButton>
              )}
              items={[
                { label: "Edit", icon: <Pencil />, onSelect: () => setEditing(true) },
                { label: entry.private ? "Mark not private" : "Mark private", icon: <Lock />, onSelect: () => update.mutate({ private: !entry.private }) },
                "separator",
                { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setConfirm(true) },
              ]}
            />
          </span>
        </div>
        {editing ? (
          <form
            className="stack"
            style={{ gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) update.mutate({ summary: text.trim() }, { onError: (err) => toast.error(errorMessage(err)) });
              setEditing(false);
            }}
          >
            <TextArea autoGrow value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit entry" autoFocus />
            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setText(entry.summary))}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit">
                Save
              </Button>
            </div>
          </form>
        ) : (
          <p className="timeline__text">{entry.summary}</p>
        )}
        {linked.length > 0 && (
          <div className="timeline__facts">
            {linked.map((f) => (
              <Tag key={f.id} size="sm" color="purple" icon={<Sparkles />}>
                {f.text}
              </Tag>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete this entry?"
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => setConfirm(false),
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      >
        Details it added to the profile stay. Delete them separately if you want.
      </ConfirmDialog>
    </li>
  );
}
