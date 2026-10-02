import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronLeft, Plus, X } from "lucide-react";
import { colorForName, contactInput, type ContactInput, type FactInput, type SocialHandle } from "@rapport/core";
import { Button, Callout, Field, IconButton, PageHeader, Skeleton, TextArea, TextInput, useToast } from "../ui";
import { api, errorMessage, useContact, useGroups, useInvalidateContact, useTags } from "../lib/api";
import { ChipInput, GroupPicker, PhotoPicker, tagNames } from "./components/Pickers";
import { KeyDateFields, emptyKeyDate, parseKeyDateDraft, type KeyDateDraft } from "./components/KeyDateDialog";
import "./pages.css";

interface FormState {
  name: string;
  nickname: string;
  photo: string | null;
  howWeKnow: string;
  groupIds: string[];
  tagNames: string[];
  phone: string;
  email: string;
  address: string;
  socials: SocialHandle[];
  // New contacts only — on existing ones these are edited on the profile.
  birthday: KeyDateDraft;
  interests: string[];
  habits: string[];
  giftIdeas: string[];
}

const blank: FormState = {
  name: "",
  nickname: "",
  photo: null,
  howWeKnow: "",
  groupIds: [],
  tagNames: [],
  phone: "",
  email: "",
  address: "",
  socials: [],
  birthday: emptyKeyDate("birthday"),
  interests: [],
  habits: [],
  giftIdeas: [],
};

export function ContactFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { data: existing, isPending, error: loadError } = useContact(id);
  const { data: groups = [] } = useGroups();
  const { data: tags = [], isSuccess: tagsLoaded } = useTags();
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateContact();
  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Fill the form once per contact, after tags have loaded so tag names resolve.
  useEffect(() => {
    if (existing && tagsLoaded && loadedId !== existing.id) {
      setLoadedId(existing.id);
      setForm({
        ...blank,
        name: existing.name,
        nickname: existing.nickname ?? "",
        photo: existing.photo,
        howWeKnow: existing.howWeKnow ?? "",
        groupIds: existing.groupIds,
        tagNames: tagNames(tags, existing.tagIds),
        phone: existing.phone ?? "",
        email: existing.email ?? "",
        address: existing.address ?? "",
        socials: existing.socials,
      });
    }
  }, [existing, tags, tagsLoaded, loadedId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    const facts: FactInput[] = [
      ...form.interests.map((text) => ({ type: "interest" as const, text })),
      ...form.habits.map((text) => ({ type: "habit" as const, text })),
      ...form.giftIdeas.map((text) => ({ type: "giftIdea" as const, text })),
    ];
    const hasBirthday = !editing && (form.birthday.day || form.birthday.month);
    const birthday = hasBirthday ? parseKeyDateDraft(form.birthday) : null;
    if (birthday && !birthday.ok) nextErrors.birthday = birthday.error;

    const input: ContactInput = {
      name: form.name,
      nickname: form.nickname,
      photo: form.photo,
      howWeKnow: form.howWeKnow,
      groupIds: form.groupIds,
      tagNames: form.tagNames,
      phone: form.phone,
      email: form.email,
      address: form.address,
      socials: form.socials.filter((s) => s.network.trim() && s.handle.trim()),
      ...(editing ? {} : { facts, keyDates: birthday?.ok ? [birthday.value] : [] }),
    };
    const parsed = contactInput.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0])] ??= issue.message;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.querySelector<HTMLElement>("[aria-invalid=true], .ui-field--error input")?.focus();
      return;
    }

    setSaving(true);
    try {
      if (editing && existing) {
        const { facts: _f, keyDates: _k, ...patch } = input;
        const updated = await api.updateContact(existing.id, patch);
        invalidate(existing.id, updated);
        toast.success("Saved");
        navigate(`/contacts/${existing.id}`, { replace: true });
      } else {
        const created = await api.createContact(input);
        invalidate(created.id, created);
        navigate(`/contacts/${created.id}`, { replace: true });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (editing && isPending) return <Skeleton width="60%" height={32} />;
  if (editing && loadError) return <Callout tone="danger" title="Couldn't load this contact">{errorMessage(loadError)}</Callout>;

  const cancelTo = editing ? `/contacts/${id}` : "/";
  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      <nav className="profile__crumb">
        <Link to={cancelTo} className="crumb-link">
          <ChevronLeft aria-hidden /> {editing ? existing?.name : "Contacts"}
        </Link>
      </nav>
      <PageHeader title={editing ? "Edit contact" : "New contact"} />

      <fieldset className="form-section">
        <PhotoPicker name={form.name} photo={form.photo} color={existing?.avatarColor ?? colorForName(form.name || "?")} onChange={(p) => set("photo", p)} />
        <Field label="Name" required error={errors.name}>
          {(fid, describedBy) => (
            <TextInput
              id={fid}
              autoFocus={!editing}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              aria-describedby={describedBy}
              invalid={Boolean(errors.name)}
              autoComplete="off"
              placeholder="Full name"
              maxLength={120}
            />
          )}
        </Field>
        <div className="form-grid form-grid--2">
          <Field label="Nickname">
            {(fid) => <TextInput id={fid} value={form.nickname} onChange={(e) => set("nickname", e.target.value)} maxLength={80} autoComplete="off" />}
          </Field>
          <Field label="How you know them">
            {(fid) => <TextInput id={fid} value={form.howWeKnow} onChange={(e) => set("howWeKnow", e.target.value)} placeholder="e.g. Uni friend, Sam's partner" maxLength={200} />}
          </Field>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend className="form-section__title">Groups & tags</legend>
        <GroupPicker groups={groups} value={form.groupIds} onChange={(v) => set("groupIds", v)} />
        <Field label="Tags" hint="Press Enter after each tag">
          {(fid) => (
            <ChipInput id={fid} label="Tags" value={form.tagNames} onChange={(v) => set("tagNames", v)} suggestions={tags.map((t) => t.name)} placeholder="climbing, met at conference…" prefix="#" />
          )}
        </Field>
      </fieldset>

      {!editing && (
        <>
          <fieldset className="form-section">
            <legend className="form-section__title">Birthday</legend>
            <KeyDateFields draft={form.birthday} onChange={(d) => set("birthday", d)} compact />
            {errors.birthday && (
              <p className="ui-field__error" role="alert">
                {errors.birthday}
              </p>
            )}
          </fieldset>

          <fieldset className="form-section">
            <legend className="form-section__title">What you know about them</legend>
            <p className="form-section__hint">Optional. You can add more later, or log a conversation and let Rapport suggest details.</p>
            <Field label="Interests">
              {(fid) => <ChipInput id={fid} label="Interests" color="blue" value={form.interests} onChange={(v) => set("interests", v)} placeholder="Type and press Enter" />}
            </Field>
            <Field label="Habits & preferences">
              {(fid) => <ChipInput id={fid} label="Habits" color="green" value={form.habits} onChange={(v) => set("habits", v)} placeholder="e.g. Early riser, oat milk" />}
            </Field>
            <Field label="Gift ideas">
              {(fid) => <ChipInput id={fid} label="Gift ideas" color="pink" value={form.giftIdeas} onChange={(v) => set("giftIdeas", v)} placeholder="e.g. Climbing chalk bag" />}
            </Field>
          </fieldset>
        </>
      )}

      <fieldset className="form-section">
        <legend className="form-section__title">Contact details</legend>
        <div className="form-grid form-grid--2">
          <Field label="Phone">
            {(fid) => <TextInput id={fid} type="tel" inputMode="tel" autoComplete="off" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={60} />}
          </Field>
          <Field label="Email" error={errors.email}>
            {(fid) => <TextInput id={fid} type="email" inputMode="email" autoComplete="off" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={200} />}
          </Field>
        </div>
        <Field label="Address">
          {(fid) => <TextArea id={fid} rows={2} autoGrow value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={500} />}
        </Field>
        <div className="stack" style={{ gap: 8 }}>
          <span className="ui-field__label">Social</span>
          {form.socials.map((s, i) => (
            <div key={i} className="social-row">
              <TextInput
                aria-label="Network"
                placeholder="Instagram"
                value={s.network}
                onChange={(e) => set("socials", form.socials.map((x, j) => (j === i ? { ...x, network: e.target.value } : x)))}
                maxLength={40}
              />
              <TextInput
                aria-label="Handle"
                placeholder="@handle"
                value={s.handle}
                onChange={(e) => set("socials", form.socials.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x)))}
                maxLength={200}
              />
              <IconButton label="Remove" onClick={() => set("socials", form.socials.filter((_, j) => j !== i))}>
                <X />
              </IconButton>
            </div>
          ))}
          <div>
            <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => set("socials", [...form.socials, { network: "", handle: "" }])}>
              Add social handle
            </Button>
          </div>
        </div>
      </fieldset>

      <div className="form-actions">
        <Button variant="ghost" onClick={() => navigate(cancelTo)}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={saving}>
          {editing ? "Save changes" : "Save contact"}
        </Button>
      </div>
    </form>
  );
}
