import { useState } from "react";
import Modal from "./Modal";
import { describeApiError } from "../../utils/apiError";

// Confirmation for destructive actions. `onConfirm` may be async; while
// it runs the buttons are disabled, and a failure is shown inside the
// dialog instead of closing it.
function ConfirmDialog({
  title,
  message,
  confirmLabel = "Sil",
  tone = "danger",
  onConfirm,
  onClose,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(describeApiError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose} width={440}>
      {error && <p className="form-error">{error}</p>}
      <p className="confirm-message">{message}</p>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          Vazgeç
        </button>
        <button
          type="button"
          className={tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy ? "İşleniyor..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
