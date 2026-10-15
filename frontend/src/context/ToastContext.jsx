import { useCallback, useMemo, useRef, useState } from "react";
import { ToastContext } from "./toastStore";
import "../components/ui/ui.css";
const TOAST_DURATION_MS = 3500;
// Rapid actions shouldn't bury the page under notifications.
const MAX_VISIBLE = 3;

// Short-lived success/error notifications after an action completes.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message, type = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, type }].slice(-MAX_VISIBLE));
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({ success: (message) => show(message, "success"), error: (message) => show(message, "error") }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={toast.type === "error" ? "toast toast-error" : "toast"} role="status">
            <span>{toast.message}</span>
            <button type="button" aria-label="Kapat" onClick={() => dismiss(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

