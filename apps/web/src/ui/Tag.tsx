import type { ButtonHTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";
import type { Color } from "@rapport/core";
import "./tag.css";

interface TagProps {
  color?: Color;
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  icon?: ReactNode;
  size?: "sm" | "md";
}

/** Notion-style pill: soft colour background, dark text, 3px radius. */
export function Tag({ color = "gray", children, onRemove, removeLabel, icon, size = "md" }: TagProps) {
  return (
    <span className={`ui-tag ui-tag--${color} ui-tag--${size}`}>
      {icon}
      <span className="ui-tag__text">{children}</span>
      {onRemove && (
        <button type="button" className="ui-tag__remove" aria-label={removeLabel ?? `Remove ${String(children)}`} onClick={onRemove}>
          <X />
        </button>
      )}
    </span>
  );
}

interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  color?: Color;
  count?: number;
}

/** Toggleable chip for filters. Uses aria-pressed. */
export function FilterChip({ selected, color, count, children, className, ...rest }: FilterChipProps) {
  return (
    <button type="button" aria-pressed={!!selected} className={["ui-chip", selected && "ui-chip--selected", className].filter(Boolean).join(" ")} {...rest}>
      {color && <ColorDot color={color} />}
      <span>{children}</span>
      {count !== undefined && <span className="ui-chip__count">{count}</span>}
    </button>
  );
}

export function ColorDot({ color, size = 8 }: { color: Color; size?: number }) {
  return <span className="ui-dot" style={{ width: size, height: size, background: `var(--tag-${color}-solid)` }} aria-hidden />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "warning" | "info" }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}
