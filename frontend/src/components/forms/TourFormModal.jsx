import { useState } from "react";
import apiClient from "../../services/apiClient";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import { useSubmit } from "../../hooks/useSubmit";
import { toPayload } from "../../utils/formPayload";
import { toInputDate } from "../../utils/date";
import { TOUR_STATUS_LABELS } from "../../utils/tourStatus";

// Create or edit a tour. `tour` null = create.
function TourFormModal({ tour, onClose, onSaved }) {
  const editing = Boolean(tour);
  const [values, setValues] = useState({
    title: tour?.title || "",
    destination: tour?.destination || "",
    start_date: toInputDate(tour?.start_date),
    end_date: toInputDate(tour?.end_date),
    status: tour?.status || "DRAFT",
    capacity: tour?.capacity != null ? String(tour.capacity) : "",
    description: tour?.description || "",
  });
  const { busy, error, setError, run } = useSubmit();

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values.title.trim() || !values.destination.trim() || !values.start_date || !values.end_date) {
      setError("Başlık, destinasyon ve tarihler zorunludur.");
      return;
    }
    if (values.end_date < values.start_date) {
      setError("Bitiş tarihi başlangıç tarihinden önce olamaz.");
      return;
    }
    if (values.capacity && (!/^\d+$/.test(values.capacity) || Number(values.capacity) <= 0)) {
      setError("Kapasite pozitif bir tam sayı olmalı.");
      return;
    }

    const payload = toPayload(values, { editing });
    if (payload.capacity) payload.capacity = Number(payload.capacity);

    let saved;
    const ok = await run(async () => {
      const response = editing
        ? await apiClient.patch(`/tours/${tour.id}`, payload)
        : await apiClient.post("/tours", payload);
      saved = response.data.data;
    });
    if (ok) onSaved(saved);
  }

  return (
    <Modal title={editing ? "Turu Düzenle" : "Yeni Tur"} onClose={onClose}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <Field label="Başlık" required className="span-2">
            {(id) => <input id={id} className="input" value={values.title} onChange={set("title")} maxLength={150} />}
          </Field>
          <Field label="Destinasyon" required>
            {(id) => <input id={id} className="input" value={values.destination} onChange={set("destination")} maxLength={150} />}
          </Field>
          <Field label="Durum">
            {(id) => (
              <select id={id} className="select" value={values.status} onChange={set("status")}>
                {Object.entries(TOUR_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Başlangıç" required>
            {(id) => <input id={id} className="input" type="date" value={values.start_date} onChange={set("start_date")} />}
          </Field>
          <Field label="Bitiş" required>
            {(id) => <input id={id} className="input" type="date" value={values.end_date} onChange={set("end_date")} />}
          </Field>
          <Field label="Kapasite" hint="Kişi sayısı (isteğe bağlı).">
            {(id) => (
              <input id={id} className="input" type="number" min="1" step="1" value={values.capacity} onChange={set("capacity")} />
            )}
          </Field>
          <Field label="Açıklama" className="span-2">
            {(id) => <textarea id={id} className="textarea" value={values.description} onChange={set("description")} />}
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Kaydediliyor..." : editing ? "Kaydet" : "Tur Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default TourFormModal;
