/**
 * Tiny self-contained toast system for transaction feedback (no external library, pure CSS via
 * Tailwind). Toasts appear bottom-center, stack, auto-dismiss after 4s, and can be closed with
 * the ✕. Use it through `useToast()`:  `toast.success("…")` / `toast.error("…")` /
 * `toast.info("…")` — info is the calm one, for something that simply didn't happen (a wallet
 * popup dismissed). That is not a failure and must not be dressed as one.
 *
 * A caller that needs longer on screen passes a duration:  `toast.success("…", 6000)`. The
 * timer is PER TOAST rather than one module-wide constant, so a message that wants more
 * reading time cannot silently retime the transaction toasts around it.
 *
 * Player vocabulary only — callers pass already-friendly messages.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  /** How long this toast stays up. Defaults to DEFAULT_AUTO_DISMISS_MS. */
  durationMs: number;
}

interface ToastApi {
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
}

/** Default dwell time. Callers may override per toast — see ToastApi. */
const DEFAULT_AUTO_DISMISS_MS = 4000;
let nextId = 0;

const ToastContext = createContext<ToastApi | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/** One toast row — owns its own auto-dismiss timer so the stack stays simple. */
function ToastView({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onClose(toast.id), toast.durationMs);
    return () => window.clearTimeout(t);
  }, [toast.id, toast.durationMs, onClose]);

  const tone =
    toast.variant === "success"
      ? "border-garden-leaf bg-garden-green/95 text-garden-mint"
      : toast.variant === "info"
        ? "border-garden-moss bg-garden-deep/95 text-garden-parch"
        : "border-garden-gold/70 bg-garden-deep/95 text-garden-gold";

  const icon = toast.variant === "success" ? "🌱" : toast.variant === "info" ? "🍃" : "⚠️";

  return (
    <div
      role="status"
      className={`pointer-events-auto flex max-w-xs items-start gap-2 rounded-lg border px-3 py-2 shadow-lg animate-rise ${tone}`}
    >
      <span aria-hidden className="mt-0.5 text-sm leading-none">
        {icon}
      </span>
      <p className="flex-1 font-body text-xs leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 font-pixel text-xs opacity-70 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant, durationMs: number = DEFAULT_AUTO_DISMISS_MS) => {
      setToasts((list) => [...list, { id: nextId++, message, variant, durationMs }]);
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, durationMs) => push(m, "success", durationMs),
      error: (m, durationMs) => push(m, "error", durationMs),
      info: (m, durationMs) => push(m, "info", durationMs),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
