import { useState } from "react";
import apiClient from "../../services/apiClient";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import TourSelect from "./TourSelect";
import { useApi } from "../../hooks/useApi";
import { useSubmit } from "../../hooks/useSubmit";
import { toPayload } from "../../utils/formPayload";
import { formatDate, formatTime } from "../../utils/date";

// Create or edit an activity. Activities belong to a tour day: on
// create the user picks the tour (unless fixed by `tourId`) and then
// one of its days.
function ActivityFormModal({ activity, tourId, onClose, onSaved }) {
  const editing = Boolean(activity);
  const [selectedTour, setSelectedTour] = useState(tourId ? String(tourId) : "");
  const [dayId, setDayId] = useState("");
  const [values, setValues] = useState({
    title: activity?.title || "",
    location: activity?.location || "",
    start_time: formatTime(activity?.start_time),
    end_time: formatTime(activity?.end_time),
    description: activity?.description || "",
  });
  const { busy, error, setError, run } = useSubmit();

  const days = useApi(
    () => apiClient.get(`/tours/${selectedTour}/days`),
    !editing && selectedTour ? `days-${selectedTour}` : null
  );
  const dayOptions = days.data?.data || [];

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!editing && !dayId) {
      setError("Tur ve gün seçin.");
      return;
    }
    if (!values.title.trim()) {
      setError("Başlık zorunludur.");
      return;
    }
    if (values.start_time && values.end_time && values.end_time < values.start_time) {
      setError("Bitiş saati başlangıçtan önce olamaz.");
      return;
    }

    const payload = toPayload(values, { editing });
    let saved;
    const ok = await run(async () => {
      const response = editing
        ? await apiClient.patch(`/activities/${activity.id}`, payload)
        : await apiClient.post(`/tour-days/${dayId}/activities`, payload);
      saved = response.data.data;
    });
    if (ok) onSaved(saved);
  }

  return (
    <Modal title={editing ? "Aktiviteyi Düzenle" : "Yeni Aktivite"} onClose={onClose}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {!editing && !tourId && (
            <Field label="Tur" required>
              {(id) => (
                <TourSelect
                  id={id}
                  value={selectedTour}
                  onChange={(value) => {
                    setSelectedTour(value);
                    setDayId("");
                  }}
                />
              )}
            </Field>
          )}
          {!editing && (
            <Field
              label="Gün"
              required
              className={tourId ? "span-2" : ""}
              hint={selectedTour && !days.loading && dayOptions.length === 0 ? "Bu turun henüz günü yok; önce tur sayfasından gün ekleyin." : undefined}
            >
              {(id) => (
                <select id={id} className="select" value={dayId} onChange={(event) => setDayId(event.target.value)} disabled={!selectedTour || days.loading}>
                  <option value="">{days.loading ? "Yükleniyor..." : "Gün seçin"}</option>
                  {dayOptions.map((day) => (
                    <option key={day.id} value={String(day.id)}>
                      Gün {day.day_number} · {formatDate(day.date)}
                      {day.title ? ` · ${day.title}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Başlık" required className="span-2">
            {(id) => <input id={id} className="input" value={values.title} onChange={set("title")} maxLength={200} />}
          </Field>
          <Field label="Başlangıç saati">
            {(id) => <input id={id} className="input" type="time" value={values.start_time} onChange={set("start_time")} />}
          </Field>
          <Field label="Bitiş saati">
            {(id) => <input id={id} className="input" type="time" value={values.end_time} onChange={set("end_time")} />}
          </Field>
          <Field label="Konum" className="span-2">
            {(id) => <input id={id} className="input" value={values.location} onChange={set("location")} maxLength={255} />}
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
            {busy ? "Kaydediliyor..." : editing ? "Kaydet" : "Aktivite Ekle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ActivityFormModal;
