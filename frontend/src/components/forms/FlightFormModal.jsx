import { useState } from "react";
import apiClient from "../../services/apiClient";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import TourSelect from "./TourSelect";
import { useSubmit } from "../../hooks/useSubmit";
import { toPayload } from "../../utils/formPayload";
import { toInputDateTime } from "../../utils/date";
import { FLIGHT_STATUS } from "../../utils/labels";

// Create or edit a flight. On create the tour is chosen here (or fixed
// by `tourId` when opened from a tour's page); a flight stays on its tour.
function FlightFormModal({ flight, tourId, onClose, onSaved }) {
  const editing = Boolean(flight);
  const [selectedTour, setSelectedTour] = useState(tourId ? String(tourId) : "");
  const [values, setValues] = useState({
    airline: flight?.airline || "",
    flight_number: flight?.flight_number || "",
    departure_airport: flight?.departure_airport || "",
    arrival_airport: flight?.arrival_airport || "",
    departure_datetime: toInputDateTime(flight?.departure_datetime),
    arrival_datetime: toInputDateTime(flight?.arrival_datetime),
    departure_terminal: flight?.departure_terminal || "",
    arrival_terminal: flight?.arrival_terminal || "",
    booking_reference: flight?.booking_reference || "",
    status: flight?.status || "SCHEDULED",
    notes: flight?.notes || "",
  });
  const { busy, error, setError, run } = useSubmit();

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!editing && !selectedTour) {
      setError("Bir tur seçin.");
      return;
    }
    const required = ["airline", "flight_number", "departure_airport", "arrival_airport", "departure_datetime", "arrival_datetime"];
    if (required.some((field) => !values[field].trim())) {
      setError("Havayolu, uçuş no, havalimanları ve kalkış/varış zamanları zorunludur.");
      return;
    }
    if (values.arrival_datetime <= values.departure_datetime) {
      setError("Varış zamanı kalkıştan sonra olmalı.");
      return;
    }

    const payload = toPayload(values, { editing });
    let saved;
    const ok = await run(async () => {
      const response = editing
        ? await apiClient.patch(`/flights/${flight.id}`, payload)
        : await apiClient.post(`/tours/${selectedTour}/flights`, payload);
      saved = response.data.data;
    });
    if (ok) onSaved(saved);
  }

  return (
    <Modal title={editing ? "Uçuşu Düzenle" : "Yeni Uçuş"} onClose={onClose} width={720}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {!editing && !tourId && (
            <Field label="Tur" required className="span-2">
              {(id) => <TourSelect id={id} value={selectedTour} onChange={setSelectedTour} />}
            </Field>
          )}
          <Field label="Havayolu" required>
            {(id) => <input id={id} className="input" value={values.airline} onChange={set("airline")} maxLength={150} />}
          </Field>
          <Field label="Uçuş no" required>
            {(id) => <input id={id} className="input" value={values.flight_number} onChange={set("flight_number")} maxLength={20} />}
          </Field>
          <Field label="Kalkış havalimanı" required>
            {(id) => (
              <input id={id} className="input" value={values.departure_airport} onChange={set("departure_airport")} maxLength={100} placeholder="IST" />
            )}
          </Field>
          <Field label="Varış havalimanı" required>
            {(id) => (
              <input id={id} className="input" value={values.arrival_airport} onChange={set("arrival_airport")} maxLength={100} placeholder="FCO" />
            )}
          </Field>
          <Field label="Kalkış" required>
            {(id) => (
              <input id={id} className="input" type="datetime-local" value={values.departure_datetime} onChange={set("departure_datetime")} />
            )}
          </Field>
          <Field label="Varış" required>
            {(id) => (
              <input id={id} className="input" type="datetime-local" value={values.arrival_datetime} onChange={set("arrival_datetime")} />
            )}
          </Field>
          <Field label="Kalkış terminali">
            {(id) => <input id={id} className="input" value={values.departure_terminal} onChange={set("departure_terminal")} maxLength={20} />}
          </Field>
          <Field label="Varış terminali">
            {(id) => <input id={id} className="input" value={values.arrival_terminal} onChange={set("arrival_terminal")} maxLength={20} />}
          </Field>
          <Field label="Rezervasyon kodu (PNR)">
            {(id) => <input id={id} className="input" value={values.booking_reference} onChange={set("booking_reference")} maxLength={50} />}
          </Field>
          <Field label="Durum">
            {(id) => (
              <select id={id} className="select" value={values.status} onChange={set("status")}>
                {Object.entries(FLIGHT_STATUS).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
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
            {busy ? "Kaydediliyor..." : editing ? "Kaydet" : "Uçuş Ekle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default FlightFormModal;
