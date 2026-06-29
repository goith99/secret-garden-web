/**
 * Tiny self-contained toast system for transaction feedback (no external library, pure CSS via
 * Tailwind). Toasts appear bottom-center, stack, auto-dismiss after 4s, and can be closed with
 * the ✕. Use it through `useToast()`:  `toast.success("…")` / `toast.error("…")`.
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

type ToastVariant = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const AUTO_DISMISS_MS = 4000;
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
    const t = window.setTimeout(() => onClose(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [toast.id, onClose]);

  const tone =
    toast.variant === "success"
      ? "border-garden-leaf bg-garden-green/95 text-garden-mint"
      : "border-garden-gold/70 bg-garden-deep/95 text-garden-gold";

  return (
    <div
      role="status"
      className={`pointer-events-auto flex max-w-xs items-start gap-2 rounded-lg border px-3 py-2 shadow-lg animate-rise ${tone}`}
    >
      <span aria-hidden className="mt-0.5 text-sm leading-none">
        {toast.variant === "success" ? "🌱" : "⚠️"}
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

  const push = useCallback((message: string, variant: ToastVariant) => {
    setToasts((list) => [...list, { id: nextId++, message, variant }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
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
