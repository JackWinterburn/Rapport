import { useState, type FormEvent } from "react";
import { Lock, LockOpen, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { FACT_TYPE_LABELS, type ContactDetail, type Fact, type FactType } from "@rapport/core";
import { IconButton, Menu, Section, useToast } from "../../ui";
import { api, errorMessage, useContactMutation } from "../../lib/api";

const ADD_LABEL: Record<FactType, string> = {
  interest: "Add interest",
  habit: "Add habit",
  preference: "Add preference",
  giftIdea: "Add gift idea",
  other: "Add detail",
};

const PLACEHOLDER: Record<FactType, string> = {
  interest: "e.g. Bouldering, Formula 1, sourdough",
  habit: "e.g. Runs before work, Sunday roast with family",
  preference: "e.g. Oat flat white, hates surprises",
  giftIdea: "e.g. Garmin running watch",
  other: "e.g. Daughter is called Maya",
};

export function FactSection({ contact, type }: { contact: ContactDetail; type: FactType }) {
  const facts = contact.facts.filter((f) => f.type === type);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const toast = useToast();
  const add = useContactMutation(contact.id, (text: string) => api.addFact(contact.id, { type, text }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return setAdding(false);
    add.mutate(text, {
      onSuccess: () => setDraft(""),
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <Section title={FACT_TYPE_LABELS[type]} count={facts.length || undefined} collapsible>
      <ul className="fact-list">
        {facts.map((f) => (
          <FactRow key={f.id} fact={f} contactId={contact.id} />
        ))}
      </ul>
      {adding ? (
        <form className="inline-add" onSubmit={submit}>
          <input
            autoFocus
            className="inline-add__input"
            value={draft}
            maxLength={500}
            placeholder={PLACEHOLDER[type]}
            aria-label={ADD_LABEL[type]}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setAdding(false), setDraft(""))}
            onBlur={() => !draft.trim() && setAdding(false)}
            enterKeyHint="done"
          />
          <div className="inline-add__actions">
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => (setAdding(false), setDraft(""))}>
              Cancel
            </button>
            <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm" disabled={!draft.trim() || add.isPending}>
              Add
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="add-row" onClick={() => setAdding(true)}>
          <span className="add-row__plus">
            <Plus />
          </span>
          {ADD_LABEL[type]}
        </button>
      )}
    </Section>
  );
}

function FactRow({ fact, contactId }: { fact: Fact; contactId: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(fact.text);
  const toast = useToast();
  const update = useContactMutation(contactId, (patch: Partial<Pick<Fact, "text" | "private">>) => api.updateFact(fact.id, patch));
  const remove = useContactMutation(contactId, () => api.deleteFact(fact.id));
  const restore = useContactMutation(contactId, () => api.addFact(contactId, { type: fact.type, text: fact.text, private: fact.private }));

  if (editing) {
    return (
      <li className="fact fact--editing">
        <form
          className="inline-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && text.trim() !== fact.text) update.mutate({ text: text.trim() }, { onError: (err) => toast.error(errorMessage(err)) });
            setEditing(false);
          }}
        >
          <input
            autoFocus
            className="inline-add__input"
            value={text}
            maxLength={500}
            aria-label="Edit detail"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setEditing(false), setText(fact.text))}
          />
          <div className="inline-add__actions">
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => (setEditing(false), setText(fact.text))}>
              Cancel
            </button>
            <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm">
              Save
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={["fact", fact.private && "fact--private"].filter(Boolean).join(" ")}>
      <span className="fact__bullet" aria-hidden />
      <span className="fact__text">{fact.text}</span>
      {fact.source === "ai" && (
        <span className="fact__badge" title="Added from a logged conversation">
          <Sparkles aria-label="From a conversation" />
        </span>
      )}
      {fact.private && (
        <span className="fact__badge" title="Private: excluded from AI and search">
          <Lock aria-label="Private" />
        </span>
      )}
      <span className="fact__actions">
        <Menu
          trigger={(p) => (
            <IconButton label={`Options for ${fact.text}`} size="sm" {...p}>
              <MoreHorizontal />
            </IconButton>
          )}
          items={[
            { label: "Edit", icon: <Pencil />, onSelect: () => setEditing(true) },
            {
              label: fact.private ? "Make visible to AI & search" : "Mark private",
              icon: fact.private ? <LockOpen /> : <Lock />,
              onSelect: () => update.mutate({ private: !fact.private }, { onError: (err) => toast.error(errorMessage(err)) }),
            },
            "separator",
            {
              label: "Delete",
              icon: <Trash2 />,
              danger: true,
              onSelect: () =>
                remove.mutate(undefined, {
                  onSuccess: () => toast.show("Detail deleted", { action: { label: "Undo", onClick: () => restore.mutate(undefined) } }),
                  onError: (err) => toast.error(errorMessage(err)),
                }),
            },
          ]}
        />
      </span>
    </li>
  );
}
