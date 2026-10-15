import { useState } from "react";
import apiClient from "../../services/apiClient";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import { useSubmit } from "../../hooks/useSubmit";
import { toPayload } from "../../utils/formPayload";
import { toInputDate } from "../../utils/date";

// Add a program day to a tour. The next day number and its date
// (tour start + n - 1) are suggested.
function DayFormModal({ tour, existingDays, onClose, onSaved }) {
  const nextNumber = existingDays.reduce((max, day) => Math.max(max, day.day_number), 0) + 1;
  const suggestedDate = (() => {
    const start = new Date(tour.start_date);
    if (Number.isNaN(start.getTime())) return "";
    start.setDate(start.getDate() + nextNumber - 1);
    return toInputDate(start);
  })();

  const [values, setValues] = useState({
    day_number: String(nextNumber),
    date: suggestedDate,
    title: "",
    description: "",
  });
  const { busy, error, setError, run } = useSubmit();
  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!/^\d+$/.test(values.day_number) || Number(values.day_number) < 1 || !values.date) {
      setError("Gün numarası (pozitif tam sayı) ve tarih zorunludur.");
      return;
    }
    const payload = toPayload(values);
    payload.day_number = Number(payload.day_number);

    let saved;
    const ok = await run(async () => {
      saved = (await apiClient.post(`/tours/${tour.id}/days`, payload)).data.data;
    });
    if (ok) onSaved(saved);
  }

  return (
    <Modal title="Gün Ekle" onClose={onClose} width={520}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <Field label="Gün no" required>
            {(id) => <input id={id} className="input" type="number" min="1" value={values.day_number} onChange={set("day_number")} />}
          </Field>
          <Field label="Tarih" required>
            {(id) => <input id={id} className="input" type="date" value={values.date} onChange={set("date")} />}
          </Field>
          <Field label="Başlık" className="span-2">
            {(id) => <input id={id} className="input" value={values.title} onChange={set("title")} maxLength={150} placeholder="Örn. Varış ve şehir turu" />}
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
            {busy ? "Kaydediliyor..." : "Gün Ekle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default DayFormModal;
