import type { InputHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import "./choice.css";

interface CheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  /** "round" is the Todoist task checkbox; "square" is a standard form checkbox. */
  shape?: "round" | "square";
  tone?: "accent" | "neutral";
}

export function Checkbox({ checked, onChange, label, shape = "square", tone = "accent", className, ...rest }: CheckProps) {
  return (
    <label className={["ui-check", `ui-check--${shape}`, `ui-check--${tone}`, className].filter(Boolean).join(" ")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} {...rest} />
      <span className="ui-check__box" aria-hidden>
        <Check strokeWidth={3} />
      </span>
      {label && <span className="ui-check__label">{label}</span>}
    </label>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label className={["ui-switch", disabled && "ui-switch--disabled"].filter(Boolean).join(" ")}>
      <span className="ui-switch__text">
        <span className="ui-switch__label">{label}</span>
        {description && <span className="ui-switch__desc">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ui-switch__track" aria-hidden>
        <span className="ui-switch__thumb" />
      </span>
    </label>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  label: string;
  size?: "sm" | "md";
}

/** Todoist-style segmented control (e.g. List / Board). */
export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: SegmentedProps<T>) {
  return (
    <div className={`ui-segmented ui-segmented--${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="ui-segmented__item"
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
