import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import "./field.css";

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired up with ids for accessibility. */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={["ui-field", error && "ui-field--error", className].filter(Boolean).join(" ")}>
      {label && (
        <label className="ui-field__label" htmlFor={id}>
          {label}
          {required && <span className="ui-field__required" aria-hidden> *</span>}
        </label>
      )}
      {children(id, describedBy)}
      {hint && !error && (
        <p className="ui-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="ui-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; leading?: ReactNode };

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput({ invalid, leading, className, ...rest }, ref) {
  if (leading) {
    return (
      <div className={["ui-input", "ui-input--with-leading", invalid && "ui-input--invalid", className].filter(Boolean).join(" ")}>
        <span className="ui-input__leading">{leading}</span>
        <input ref={ref} aria-invalid={invalid || undefined} {...rest} />
      </div>
    );
  }
  return <input ref={ref} className={["ui-input", invalid && "ui-input--invalid", className].filter(Boolean).join(" ")} aria-invalid={invalid || undefined} {...rest} />;
});

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; autoGrow?: boolean };

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea({ invalid, autoGrow, className, onInput, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={["ui-input", "ui-textarea", invalid && "ui-input--invalid", className].filter(Boolean).join(" ")}
      aria-invalid={invalid || undefined}
      onInput={(e) => {
        if (autoGrow) {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight + 2}px`;
        }
        onInput?.(e);
      }}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={["ui-input", "ui-select", invalid && "ui-input--invalid", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </select>
  );
});

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

/** Notion-style quiet search box with a clear button. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput({ value, onChange, className, ...rest }, ref) {
  return (
    <div className={["ui-search", className].filter(Boolean).join(" ")}>
      <Search aria-hidden className="ui-search__icon" />
      <input ref={ref} type="search" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      {value && (
        <button type="button" className="ui-search__clear" aria-label="Clear search" onClick={() => onChange("")}>
          <X />
        </button>
      )}
    </div>
  );
});
