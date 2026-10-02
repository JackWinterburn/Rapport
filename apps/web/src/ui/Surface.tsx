import type { HTMLAttributes, ReactNode } from "react";
import "./surface.css";

export function Card({ className, padded = true, interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { padded?: boolean; interactive?: boolean }) {
  return <div className={["ui-card", padded && "ui-card--padded", interactive && "ui-card--interactive", className].filter(Boolean).join(" ")} {...rest} />;
}

type CalloutTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

/** Notion callout block: icon + text on a soft tinted background. */
export function Callout({ icon, tone = "neutral", title, children, action }: { icon?: ReactNode; tone?: CalloutTone; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`ui-callout ui-callout--${tone}`} role={tone === "danger" ? "alert" : undefined}>
      {icon && <span className="ui-callout__icon">{icon}</span>}
      <div className="ui-callout__body">
        {title && <p className="ui-callout__title">{title}</p>}
        {children && <div className="ui-callout__text">{children}</div>}
        {action && <div className="ui-callout__action">{action}</div>}
      </div>
    </div>
  );
}

export function Divider({ label }: { label?: ReactNode }) {
  return label ? (
    <div className="ui-divider ui-divider--label" role="separator">
      <span>{label}</span>
    </div>
  ) : (
    <hr className="ui-divider" />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ui-empty">
      {icon && <div className="ui-empty__icon">{icon}</div>}
      <h2 className="ui-empty__title">{title}</h2>
      {children && <p className="ui-empty__text">{children}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}
