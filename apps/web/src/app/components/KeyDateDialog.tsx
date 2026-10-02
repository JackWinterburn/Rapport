import { useEffect, useState } from "react";
import { keyDateInput, type KeyDate, type KeyDateInput } from "@rapport/core";
import { Button, Dialog, Field, Select, Switch, TextInput } from "../../ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "No reminder" },
  { value: "0", label: "On the day" },
  { value: "1", label: "1 day before" },
  { value: "3", label: "3 days before" },
  { value: "7", label: "1 week before" },
  { value: "14", label: "2 weeks before" },
  { value: "28", label: "4 weeks before" },
];

export interface KeyDateDraft {
  label: KeyDate["label"];
  customLabel: string;
  day: string;
  month: string;
  year: string;
  repeatsYearly: boolean;
  reminderDays: string;
}

export const emptyKeyDate = (label: KeyDate["label"] = "birthday"): KeyDateDraft => ({
  label,
  customLabel: "",
  day: "",
  month: "",
  year: "",
  repeatsYearly: true,
  reminderDays: label === "birthday" ? "7" : "",
});

export function draftFromKeyDate(kd: KeyDate): KeyDateDraft {
  return {
    label: kd.label,
    customLabel: kd.customLabel ?? "",
    day: String(kd.day),
    month: String(kd.month),
    year: kd.year ? String(kd.year) : "",
    repeatsYearly: kd.repeatsYearly,
    reminderDays: kd.reminderDays === null ? "" : String(kd.reminderDays),
  };
}

/** Validate a draft with the shared core schema. Returns input or a message. */
export function parseKeyDateDraft(d: KeyDateDraft): { ok: true; value: KeyDateInput } | { ok: false; error: string } {
  if (!d.day || !d.month) return { ok: false, error: "Pick a day and month" };
  const value: KeyDateInput = {
    label: d.label,
    customLabel: d.label === "other" ? d.customLabel || null : null,
    day: Number(d.day),
    month: Number(d.month),
    year: d.year ? Number(d.year) : null,
    repeatsYearly: d.repeatsYearly,
    reminderDays: d.reminderDays === "" ? null : Number(d.reminderDays),
  };
  const r = keyDateInput.safeParse(value);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Invalid date" };
  if (d.label === "other" && !d.customLabel.trim()) return { ok: false, error: "Give the date a name" };
  return { ok: true, value };
}

/** Day / month / year inputs. Year is optional for birthdays (age shows when known). */
export function KeyDateFields({ draft, onChange, compact }: { draft: KeyDateDraft; onChange: (d: KeyDateDraft) => void; compact?: boolean }) {
  const set = <K extends keyof KeyDateDraft>(k: K, v: KeyDateDraft[K]) => onChange({ ...draft, [k]: v });
  return (
    <div className="stack" style={{ gap: 12 }}>
      {!compact && (
        <div className="form-grid form-grid--2">
          <Field label="Type">
            {(id) => (
              <Select id={id} value={draft.label} onChange={(e) => set("label", e.target.value as KeyDate["label"])}>
                <option value="birthday">Birthday</option>
                <option value="anniversary">Anniversary</option>
                <option value="other">Other…</option>
              </Select>
            )}
          </Field>
          {draft.label === "other" && (
            <Field label="Name">
              {(id) => <TextInput id={id} value={draft.customLabel} onChange={(e) => set("customLabel", e.target.value)} placeholder="e.g. Work anniversary" maxLength={60} />}
            </Field>
          )}
        </div>
      )}
      <div className="date-fields">
        <Field label="Day">
          {(id) => <TextInput id={id} inputMode="numeric" pattern="[0-9]*" maxLength={2} value={draft.day} onChange={(e) => set("day", e.target.value.replace(/\D/g, ""))} placeholder="DD" />}
        </Field>
        <Field label="Month">
          {(id) => (
            <Select id={id} value={draft.month} onChange={(e) => set("month", e.target.value)}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Year" hint={compact ? undefined : "Optional"}>
          {(id) => <TextInput id={id} inputMode="numeric" pattern="[0-9]*" maxLength={4} value={draft.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, ""))} placeholder="YYYY" />}
        </Field>
      </div>
      <Field label="Reminder">
        {(id) => (
          <Select id={id} value={draft.reminderDays} onChange={(e) => set("reminderDays", e.target.value)}>
            {REMINDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {!compact && (
        <Switch
          checked={draft.repeatsYearly}
          onChange={(v) => set("repeatsYearly", v)}
          label="Repeats every year"
          description={draft.repeatsYearly ? undefined : "One-off dates need a year."}
        />
      )}
    </div>
  );
}

export function KeyDateDialog({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial: KeyDate | null;
  onClose: () => void;
  onSave: (input: KeyDateInput) => void;
  saving?: boolean;
}) {
  const [draft, setDraft] = useState<KeyDateDraft>(emptyKeyDate());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setDraft(initial ? draftFromKeyDate(initial) : emptyKeyDate());
      setError(null);
    }
  }, [open, initial]);

  const submit = () => {
    const r = parseKeyDateDraft(draft);
    if (!r.ok) setError(r.error);
    else onSave(r.value);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? "Edit date" : "Add a key date"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <KeyDateFields draft={draft} onChange={setDraft} />
        {error && (
          <p className="ui-field__error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
