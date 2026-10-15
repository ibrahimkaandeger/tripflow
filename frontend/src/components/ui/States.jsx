// Shared loading / error / empty placeholders so every list and detail
// view looks and behaves the same.

export function LoadingState({ label = "Yükleniyor..." }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Tekrar dene
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="state">
      {title && <p className="state-title">{title}</p>}
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
