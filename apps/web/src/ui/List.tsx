import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import "./list.css";

interface ListRowProps {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  /** Revealed on hover (desktop) like Todoist row actions; always visible on touch. */
  actions?: ReactNode;
  to?: string;
  onClick?: () => void;
  selected?: boolean;
}

/** Todoist task-row anatomy: leading control, title, meta line, hover actions, hairline divider. */
export function ListRow({ leading, title, meta, description, trailing, actions, to, onClick, selected }: ListRowProps) {
  const body = (
    <>
      {leading && <span className="ui-row__leading">{leading}</span>}
      <span className="ui-row__main">
        <span className="ui-row__title">{title}</span>
        {description && <span className="ui-row__desc">{description}</span>}
        {meta && <span className="ui-row__meta">{meta}</span>}
      </span>
      {trailing && <span className="ui-row__trailing">{trailing}</span>}
    </>
  );
  return (
    <li className={["ui-row", selected && "ui-row--selected"].filter(Boolean).join(" ")}>
      {to ? (
        <Link to={to} className="ui-row__link">
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" className="ui-row__link" onClick={onClick}>
          {body}
        </button>
      ) : (
        <div className="ui-row__link ui-row__link--static">{body}</div>
      )}
      {actions && <span className="ui-row__actions">{actions}</span>}
    </li>
  );
}

export function List({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="ui-list" aria-label={label}>
      {children}
    </ul>
  );
}

interface SectionProps {
  title: ReactNode;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  tone?: "default" | "accent";
}

/** Todoist section header: bold title, count, chevron to collapse, hairline below. */
export function Section({ title, count, children, action, collapsible = false, defaultOpen = true, tone = "default" }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`ui-section ui-section--${tone}`}>
      <header className="ui-section__header">
        {collapsible ? (
          <button type="button" className="ui-section__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <ChevronRight className="ui-section__chevron" aria-hidden />
            <h2 className="ui-section__title">{title}</h2>
            {count !== undefined && <span className="ui-section__count">{count}</span>}
          </button>
        ) : (
          <div className="ui-section__toggle ui-section__toggle--static">
            <h2 className="ui-section__title">{title}</h2>
            {count !== undefined && <span className="ui-section__count">{count}</span>}
          </div>
        )}
        {action && <div className="ui-section__action">{action}</div>}
      </header>
      {(!collapsible || open) && <div className="ui-section__body">{children}</div>}
    </section>
  );
}

/** Notion page properties: icon + label column, value column. */
export function PropertyList({ children }: { children: ReactNode }) {
  return <dl className="ui-props">{children}</dl>;
}

export function Property({ icon, label, children, empty = "Empty" }: { icon?: ReactNode; label: ReactNode; children?: ReactNode; empty?: ReactNode }) {
  const isEmpty = children === null || children === undefined || children === "" || (Array.isArray(children) && children.length === 0);
  return (
    <div className="ui-prop">
      <dt className="ui-prop__label">
        {icon}
        <span>{label}</span>
      </dt>
      <dd className={["ui-prop__value", isEmpty && "ui-prop__value--empty"].filter(Boolean).join(" ")}>{isEmpty ? empty : children}</dd>
    </div>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  size?: "page" | "view";
}

/** "page" = Notion document title (40px bold). "view" = Todoist view title (24px bold). */
export function PageHeader({ title, icon, subtitle, actions, breadcrumb, size = "view" }: PageHeaderProps) {
  return (
    <header className={`ui-page-header ui-page-header--${size}`}>
      {breadcrumb && <div className="ui-page-header__crumb">{breadcrumb}</div>}
      {icon && <div className="ui-page-header__icon">{icon}</div>}
      <div className="ui-page-header__row">
        <h1 className="ui-page-header__title">{title}</h1>
        {actions && <div className="ui-page-header__actions">{actions}</div>}
      </div>
      {subtitle && <p className="ui-page-header__subtitle">{subtitle}</p>}
    </header>
  );
}
