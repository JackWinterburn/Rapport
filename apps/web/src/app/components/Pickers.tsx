import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Camera, ImageOff } from "lucide-react";
import type { Color, Group, Tag as TagModel } from "@rapport/core";
import { Avatar, Button, FilterChip, Tag, useToast } from "../../ui";
import { resizePhoto } from "../../lib/device";

export function GroupPicker({ groups, value, onChange }: { groups: Group[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="chip-wrap" role="group" aria-label="Groups">
      {groups.map((g) => {
        const on = value.includes(g.id);
        return (
          <FilterChip key={g.id} color={g.color} selected={on} onClick={() => onChange(on ? value.filter((x) => x !== g.id) : [...value, g.id])}>
            {g.name}
          </FilterChip>
        );
      })}
      {groups.length === 0 && <span className="text-tertiary text-sm">No groups yet. Create them in Settings.</span>}
    </div>
  );
}

/**
 * Free-text chips: type and press Enter or comma. Used for tags and for quick
 * lists of interests / gift ideas on the add-contact form.
 */
export function ChipInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  color = "gray",
  prefix = "",
  label,
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  color?: Color;
  prefix?: string;
  label: string;
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const add = (raw: string) => {
    const v = raw.trim().replace(/^#/, "");
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <div className="chip-input ui-input" onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
      {value.map((v) => (
        <Tag key={v} color={color} onRemove={() => onChange(value.filter((x) => x !== v))} removeLabel={`Remove ${v}`}>
          {prefix}
          {v}
        </Tag>
      ))}
      <input
        id={id}
        aria-label={label}
        value={draft}
        list={remaining.length ? listId : undefined}
        placeholder={value.length ? "" : placeholder}
        onChange={(e) => {
          // Picking from the datalist fires change with the full value.
          if (remaining.includes(e.target.value)) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => draft && add(draft)}
        enterKeyHint="done"
      />
      {remaining.length > 0 && (
        <datalist id={listId}>
          {remaining.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

export function tagNames(tags: TagModel[], ids: string[]) {
  return ids.map((id) => tags.find((t) => t.id === id)?.name).filter((n): n is string => Boolean(n));
}

export function PhotoPicker({ name, photo, color, onChange }: { name: string; photo: string | null; color: Color; onChange: (photo: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="photo-picker">
      <Avatar name={name || "?"} photo={photo} color={color} size="xl" />
      <div className="stack" style={{ gap: 8 }}>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            try {
              onChange(await resizePhoto(file));
            } catch {
              toast.error("Couldn't read that image. Try a JPEG or PNG.");
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button size="sm" icon={<Camera />} loading={busy} onClick={() => input.current?.click()}>
          {photo ? "Change photo" : "Add photo"}
        </Button>
        {photo && (
          <Button size="sm" variant="ghost" icon={<ImageOff />} onClick={() => onChange(null)}>
            Use initials
          </Button>
        )}
      </div>
    </div>
  );
}
