import { useState } from "react";
import apiClient from "../../services/apiClient";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import TourSelect from "./TourSelect";
import { useSubmit } from "../../hooks/useSubmit";
import { toPayload } from "../../utils/formPayload";
import { toInputDate } from "../../utils/date";
import { HOTEL_STATUS } from "../../utils/labels";

// Create or edit a hotel booking; the tour is chosen on create.
function HotelFormModal({ hotel, tourId, onClose, onSaved }) {
  const editing = Boolean(hotel);
  const [selectedTour, setSelectedTour] = useState(tourId ? String(tourId) : "");
  const [values, setValues] = useState({
    hotel_name: hotel?.hotel_name || "",
    city: hotel?.city || "",
    country: hotel?.country || "",
    address: hotel?.address || "",
    check_in: toInputDate(hotel?.check_in),
    check_out: toInputDate(hotel?.check_out),
    booking_reference: hotel?.booking_reference || "",
    status: hotel?.status || "PENDING",
    notes: hotel?.notes || "",
  });
  const { busy, error, setError, run } = useSubmit();

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!editing && !selectedTour) {
      setError("Bir tur seçin.");
      return;
    }
    if (!values.hotel_name.trim() || !values.check_in || !values.check_out) {
      setError("Otel adı, giriş ve çıkış tarihleri zorunludur.");
      return;
    }
    if (values.check_out < values.check_in) {
      setError("Çıkış tarihi girişten önce olamaz.");
      return;
    }

    const payload = toPayload(values, { editing });
    let saved;
    const ok = await run(async () => {
      const response = editing
        ? await apiClient.patch(`/hotels/${hotel.id}`, payload)
        : await apiClient.post(`/tours/${selectedTour}/hotels`, payload);
      saved = response.data.data;
    });
    if (ok) onSaved(saved);
  }

  return (
    <Modal title={editing ? "Oteli Düzenle" : "Yeni Otel"} onClose={onClose} width={720}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {!editing && !tourId && (
            <Field label="Tur" required className="span-2">
              {(id) => <TourSelect id={id} value={selectedTour} onChange={setSelectedTour} />}
            </Field>
          )}
          <Field label="Otel adı" required className="span-2">
            {(id) => <input id={id} className="input" value={values.hotel_name} onChange={set("hotel_name")} maxLength={200} />}
          </Field>
          <Field label="Şehir">
            {(id) => <input id={id} className="input" value={values.city} onChange={set("city")} maxLength={100} />}
          </Field>
          <Field label="Ülke">
            {(id) => <input id={id} className="input" value={values.country} onChange={set("country")} maxLength={100} />}
          </Field>
          <Field label="Giriş" required>
            {(id) => <input id={id} className="input" type="date" value={values.check_in} onChange={set("check_in")} />}
          </Field>
          <Field label="Çıkış" required>
            {(id) => <input id={id} className="input" type="date" value={values.check_out} onChange={set("check_out")} />}
          </Field>
          <Field label="Rezervasyon kodu">
            {(id) => <input id={id} className="input" value={values.booking_reference} onChange={set("booking_reference")} maxLength={50} />}
          </Field>
          <Field label="Durum">
            {(id) => (
              <select id={id} className="select" value={values.status} onChange={set("status")}>
                {Object.entries(HOTEL_STATUS).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Adres" className="span-2">
            {(id) => <textarea id={id} className="textarea" value={values.address} onChange={set("address")} />}
          </Field>
          <Field label="Notlar" className="span-2">
            {(id) => <textarea id={id} className="textarea" value={values.notes} onChange={set("notes")} />}
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Kaydediliyor..." : editing ? "Kaydet" : "Otel Ekle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default HotelFormModal;
