import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Check, ChevronLeft, Info, Mic, MicOff, Pencil, ShieldCheck, Sparkles, Undo2, X } from "lucide-react";
import {
  FACT_TYPES,
  FACT_TYPE_LABELS,
  formatMonthDay,
  searchContacts,
  todayLocal,
  toIsoDay,
  type CaptureProposal,
  type ContactSummary,
  type FactType,
  type Suggestion,
} from "@rapport/core";
import { Avatar, Button, Callout, EmptyState, Field, List, ListRow, PageHeader, SearchInput, Select, Spinner, Tag, TextArea, TextInput, useToast } from "../ui";
import { api, errorMessage, useContact, useContacts, useInvalidateContact } from "../lib/api";
import { dictationSupported, startDictation, useOnline } from "../lib/device";
import "./pages.css";

type Decision = "pending" | "accepted" | "rejected";
interface Card {
  suggestion: Suggestion;
  decision: Decision;
  editing: boolean;
}

const TYPE_COLOR: Record<FactType | "keyDate", Parameters<typeof Tag>[0]["color"]> = {
  interest: "blue",
  habit: "green",
  preference: "yellow",
  giftIdea: "pink",
  other: "gray",
  keyDate: "orange",
};

const typeLabel = (s: Suggestion) => (s.kind === "keyDate" ? "Key date" : FACT_TYPE_LABELS[s.factType].replace(/s$/, "").replace(/ideas$/, "idea"));

/**
 * User flow 3: describe a conversation → AI proposes updates → accept, edit or
 * reject each card → only approved items are saved, plus a timeline entry.
 */
export function CapturePage() {
  const [params, setParams] = useSearchParams();
  const contactId = params.get("contact");
  const { data: contact } = useContact(contactId ?? undefined);
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateContact();
  const online = useOnline();

  const [text, setText] = useState("");
  const [date, setDate] = useState(toIsoDay(todayLocal()));
  const [proposal, setProposal] = useState<CaptureProposal | null>(null);
  const [summary, setSummary] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const stopRef = useRef<() => void>(() => {});

  if (!contactId) return <ContactPicker onPick={(id) => setParams({ contact: id })} />;

  const suggest = async () => {
    setError(null);
    setLoading(true);
    stopRef.current();
    try {
      const p = await api.proposeCapture(contactId, text);
      setProposal(p);
      setSummary(p.summary);
      setCards(p.suggestions.map((s) => ({ suggestion: s, decision: "pending", editing: false })));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const accepted = cards.filter((c) => c.decision === "accepted").map((c) => c.suggestion);
      const detail = await api.commitCapture(contactId, { text, summary: summary.trim() || text.slice(0, 280), date, accepted });
      invalidate(contactId, detail);
      toast.success(accepted.length ? `Saved ${accepted.length} ${accepted.length === 1 ? "detail" : "details"} to ${contact?.nickname || contact?.name}` : "Conversation logged");
      navigate(`/contacts/${contactId}`, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  };

  const toggleDictation = () => {
    if (listening) return stopRef.current();
    setListening(true);
    stopRef.current = startDictation(
      (t) => setText((prev) => (prev ? `${prev.trimEnd()} ${t}` : t)),
      () => setListening(false),
      (msg) => toast.error(msg),
    );
  };

  const update = (i: number, patch: Partial<Card>) => setCards((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const name = contact ? contact.nickname || contact.name.split(" ")[0] : "them";
  const accepted = cards.filter((c) => c.decision === "accepted").length;
  const pending = cards.filter((c) => c.decision === "pending").length;

  // ---------------------------------------------------------------- review
  if (proposal) {
    const dropped = proposal.dropped.sensitive + proposal.dropped.ungrounded;
    return (
      <div className="capture">
        <nav className="profile__crumb">
          <button type="button" className="crumb-link" onClick={() => setProposal(null)}>
            <ArrowLeft aria-hidden /> Back to edit
          </button>
        </nav>
        <PageHeader title="Review suggestions" subtitle={<>Nothing is saved until you approve it. Accept, edit or reject each one.</>} />

        <Field label="Conversation summary" hint={`Saved to ${name}'s timeline`}>
          {(id) => <TextArea id={id} autoGrow rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} />}
        </Field>

        {cards.length === 0 ? (
          <Callout icon={<Info />} title="Nothing new to remember">
            No new details stood out. You can still save the conversation to the timeline.
          </Callout>
        ) : (
          <>
            <div className="review-bar">
              <span className="text-secondary text-sm">
                {accepted} accepted · {pending} to review
              </span>
              {pending > 0 && (
                <Button size="sm" variant="ghost" icon={<Check />} onClick={() => setCards((cs) => cs.map((c) => (c.decision === "pending" ? { ...c, decision: "accepted" } : c)))}>
                  Accept all
                </Button>
              )}
            </div>
            <ul className="suggestions">
              {cards.map((card, i) => (
                <SuggestionCard key={card.suggestion.id} card={card} onChange={(patch) => update(i, patch)} />
              ))}
            </ul>
          </>
        )}

        {dropped > 0 && (
          <p className="dropped-note">
            <ShieldCheck aria-hidden />
            {dropped} {dropped === 1 ? "suggestion was" : "suggestions were"} left out because {proposal.dropped.sensitive ? "they touched on sensitive topics" : ""}
            {proposal.dropped.sensitive && proposal.dropped.ungrounded ? " or " : ""}
            {proposal.dropped.ungrounded ? "they weren't in what you wrote" : ""}.
          </p>
        )}

        <div className="form-actions form-actions--sticky">
          <Button variant="ghost" onClick={() => navigate(`/contacts/${contactId}`)}>
            Discard
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {accepted ? `Save ${accepted} ${accepted === 1 ? "update" : "updates"}` : "Save to timeline"}
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- compose
  return (
    <div className="capture">
      <nav className="profile__crumb">
        <Link to={`/contacts/${contactId}`} className="crumb-link">
          <ChevronLeft aria-hidden /> {contact?.name ?? "Contact"}
        </Link>
      </nav>
      <PageHeader
        title="Log a conversation"
        subtitle={
          contact && (
            <span className="row" style={{ gap: 8 }}>
              <Avatar name={contact.name} photo={contact.photo} color={contact.avatarColor} size="xs" />
              with {contact.name}
              <button type="button" className="ui-btn ui-btn--link" onClick={() => setParams({})}>
                Change
              </button>
            </span>
          )
        }
      />

      <form
        className="stack"
        style={{ gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 3) void suggest();
        }}
      >
        <div className="capture__box">
          <TextArea
            autoFocus
            autoGrow
            rows={5}
            value={text}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            placeholder={`What did you talk about? e.g. “Coffee with ${name}. She's training for the Berlin marathon in March and wants a new running watch. Her daughter Maya starts school next week.”`}
            aria-label="What you talked about"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
            }}
          />
          <div className="capture__tools">
            {dictationSupported() && (
              <Button size="sm" variant={listening ? "primary" : "ghost"} icon={listening ? <MicOff /> : <Mic />} onClick={toggleDictation} aria-pressed={listening}>
                {listening ? "Stop" : "Dictate"}
              </Button>
            )}
            <span className="text-xs text-tertiary">{text.length}/4000</span>
          </div>
        </div>

        <div className="form-grid form-grid--2">
          <Field label="When">
            {(id) => <TextInput id={id} type="date" value={date} max={toIsoDay(todayLocal())} onChange={(e) => setDate(e.target.value || toIsoDay(todayLocal()))} />}
          </Field>
        </div>

        {error && (
          <Callout tone="danger" title="Couldn't get suggestions">
            {error}
          </Callout>
        )}

        <div className="form-actions">
          <Button
            variant="secondary"
            disabled={text.trim().length < 3}
            onClick={() => {
              setProposal({ summary: text.trim().slice(0, 280), suggestions: [], dropped: { sensitive: 0, ungrounded: 0, duplicate: 0, invalid: 0 } });
              setSummary(text.trim().slice(0, 2000));
              setCards([]);
            }}
          >
            Save without AI
          </Button>
          <Button variant="primary" type="submit" icon={loading ? undefined : <Sparkles />} loading={loading} disabled={text.trim().length < 3 || !online}>
            Suggest updates
          </Button>
        </div>

        <p className="privacy-note">
          <ShieldCheck aria-hidden />
          <span>
            “Suggest updates” sends this text, {name}'s name and their non-private interests to Google Gemini. Contact details, photos and private notes are never sent.
          </span>
        </p>
      </form>

      {loading && (
        <div className="capture__thinking" role="status">
          <Spinner /> Reading your notes…
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ card, onChange }: { card: Card; onChange: (patch: Partial<Card>) => void }) {
  const s = card.suggestion;
  const [text, setText] = useState(s.text);
  const [factType, setFactType] = useState<FactType>(s.kind === "fact" ? s.factType : "other");
  const color = TYPE_COLOR[s.kind === "keyDate" ? "keyDate" : s.factType];

  return (
    <li className={`suggestion suggestion--${card.decision}`}>
      <div className="suggestion__head">
        <Tag color={color} size="sm">
          {typeLabel(s)}
        </Tag>
        {card.decision === "accepted" && <span className="suggestion__state suggestion__state--ok">Accepted</span>}
        {card.decision === "rejected" && <span className="suggestion__state">Rejected</span>}
      </div>

      {card.editing ? (
        <form
          className="stack"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            const next: Suggestion = s.kind === "fact" ? { ...s, text: text.trim() || s.text, factType } : { ...s, text: text.trim() || s.text };
            onChange({ suggestion: next, editing: false, decision: "accepted" });
          }}
        >
          <TextInput autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-label="Suggestion text" maxLength={s.kind === "fact" ? 500 : 200} />
          {s.kind === "fact" && (
            <Select aria-label="Type" value={factType} onChange={(e) => setFactType(e.target.value as FactType)}>
              {FACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FACT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Button size="sm" variant="ghost" onClick={() => onChange({ editing: false })}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" type="submit">
              Save & accept
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="suggestion__text">
            {s.text}
            {s.kind === "keyDate" && <span className="text-secondary"> · {formatMonthDay(s.month, s.day, s.year)}</span>}
          </p>
          {s.evidence && <p className="suggestion__evidence">You wrote: “{s.evidence}”</p>}
          <div className="suggestion__actions">
            {card.decision === "pending" ? (
              <>
                <Button size="sm" variant="ghost" icon={<X />} onClick={() => onChange({ decision: "rejected" })} aria-label={`Reject ${s.text}`}>
                  Reject
                </Button>
                <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => onChange({ editing: true })} aria-label={`Edit ${s.text}`}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" icon={<Check />} onClick={() => onChange({ decision: "accepted" })} aria-label={`Accept ${s.text}`}>
                  Accept
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => onChange({ decision: "pending" })}>
                Undo
              </Button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function ContactPicker({ onPick }: { onPick: (id: string) => void }) {
  const { data: contacts = [], isPending } = useContacts();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const r = searchContacts(contacts, { query: q }).map((x) => x.contact);
    // Most recently spoken-to first when not searching.
    return q ? r : [...r].sort((a: ContactSummary, b: ContactSummary) => (b.lastInteracted ?? "").localeCompare(a.lastInteracted ?? ""));
  }, [contacts, q]);

  return (
    <div className="capture">
      <PageHeader title="Log a conversation" subtitle="Who did you talk to?" />
      {!isPending && contacts.length === 0 ? (
        <EmptyState title="No contacts yet" action={<Link to="/contacts/new" className="ui-btn ui-btn--primary ui-btn--md">Add a contact</Link>}>
          Add someone first, then log your conversations with them.
        </EmptyState>
      ) : (
        <>
          <SearchInput autoFocus value={q} onChange={setQ} placeholder="Search contacts" aria-label="Search contacts" />
          <List label="Contacts">
            {results.slice(0, 30).map((c) => (
              <ListRow
                key={c.id}
                onClick={() => onPick(c.id)}
                leading={<Avatar name={c.name} photo={c.photo} color={c.avatarColor} size="sm" />}
                title={c.name}
                description={c.howWeKnow}
              />
            ))}
          </List>
        </>
      )}
    </div>
  );
}
