import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import "./feedback.css";

type ToastTone = "neutral" | "success" | "error";
interface ToastItem {
  id: number;
  message: ReactNode;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}
interface ToastApi {
  show: (message: ReactNode, opts?: { tone?: ToastTone; action?: ToastItem["action"]; duration?: number }) => void;
  success: (message: ReactNode) => void;
  error: (message: ReactNode) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((t) => t.id !== id)), []);
  const show = useCallback<ToastApi["show"]>(
    (message, opts = {}) => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-2), { id, message, tone: opts.tone ?? "neutral", action: opts.action }]);
      setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 6000 : 3500));
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({ show, success: (m) => show(m, { tone: "success" }), error: (m) => show(m, { tone: "error", duration: 6000 }) }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toasts" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`ui-toast ui-toast--${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>
            <span className="ui-toast__icon" aria-hidden>
              {t.tone === "success" ? <CheckCircle2 /> : t.tone === "error" ? <AlertCircle /> : <Info />}
            </span>
            <span className="ui-toast__message">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="ui-toast__action"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="ui-toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
