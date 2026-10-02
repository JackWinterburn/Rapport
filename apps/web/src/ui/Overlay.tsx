import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button, IconButton } from "./Button";
import "./overlay.css";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

/**
 * Modal built on the native <dialog> element (focus trap, Escape, inert background).
 * Centered card on desktop (Todoist), bottom sheet on phones.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`ui-dialog ui-dialog--${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
    >
      {open && (
        <div className="ui-dialog__panel">
          <div className="ui-dialog__grabber" aria-hidden />
          <header className="ui-dialog__header">
            <div>
              <h2 id={titleId} className="ui-dialog__title">
                {title}
              </h2>
              {description && (
                <p id={descId} className="ui-dialog__desc">
                  {description}
                </p>
              )}
            </div>
            <IconButton label="Close" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          </header>
          {children && <div className="ui-dialog__body">{children}</div>}
          {footer && <footer className="ui-dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, children, confirmLabel, danger, loading, onConfirm, onClose }: ConfirmProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className={danger ? "ui-btn--destructive" : undefined} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  trigger: (props: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu"; "aria-controls": string }) => ReactNode;
  items: (MenuItem | "separator")[];
  align?: "start" | "end";
}

/** Notion-style popover menu with arrow-key navigation. */
export function Menu({ trigger, items, align = "end" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [flipUp, setFlipUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !list.current) return;
    const rect = list.current.getBoundingClientRect();
    setFlipUp(rect.bottom > window.innerHeight - 8 && rect.top > rect.height);
    list.current.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      buttons[(i + 1) % buttons.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="ui-menu-wrap" ref={wrap}>
      {trigger({ onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu", "aria-controls": id })}
      {open && (
        <div
          ref={list}
          id={id}
          role="menu"
          className={["ui-menu", `ui-menu--${align}`, flipUp && "ui-menu--up"].filter(Boolean).join(" ")}
          onKeyDown={onKeyDown}
        >
          {items.map((item, i) =>
            item === "separator" ? (
              <div key={i} className="ui-menu__sep" role="separator" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={["ui-menu__item", item.danger && "ui-menu__item--danger"].filter(Boolean).join(" ")}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Todoist's floating red "+" (mobile quick action). */
export function Fab({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="ui-fab" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}
