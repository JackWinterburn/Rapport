import "./feedback.css";

export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span className="ui-spinner" style={{ width: size, height: size }} role={label ? "status" : undefined} aria-label={label}>
      <svg viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Skeleton({ width, height = 14, radius, className }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return <span className={["ui-skeleton", className].filter(Boolean).join(" ")} style={{ width, height, borderRadius: radius }} aria-hidden />;
}
