import { initials, type Color } from "@rapport/core";
import "./avatar.css";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
const PX: Record<AvatarSize, number> = { xs: 20, sm: 28, md: 36, lg: 56, xl: 96 };

interface AvatarProps {
  name: string;
  photo?: string | null;
  color?: Color;
  size?: AvatarSize;
}

/** Photo when there is one, otherwise initials on the person's colour. */
export function Avatar({ name, photo, color = "gray", size = "md" }: AvatarProps) {
  const px = PX[size];
  return (
    <span
      className={`ui-avatar ui-avatar--${size}`}
      style={{ width: px, height: px, background: photo ? undefined : `var(--tag-${color}-solid)` }}
      role="img"
      aria-label={name}
    >
      {photo ? <img src={photo} alt="" loading="lazy" /> : <span aria-hidden>{initials(name)}</span>}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = "sm" }: { people: AvatarProps[]; max?: number; size?: AvatarSize }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="ui-avatar-stack">
      {shown.map((p, i) => (
        <Avatar key={i} {...p} size={size} />
      ))}
      {extra > 0 && (
        <span className={`ui-avatar ui-avatar--${size} ui-avatar--more`} style={{ width: PX[size], height: PX[size] }}>
          +{extra}
        </span>
      )}
    </span>
  );
}
