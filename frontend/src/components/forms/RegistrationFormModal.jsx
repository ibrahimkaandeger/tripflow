import { useState } from "react";
import apiClient from "../../services/apiClient";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import CustomerPicker from "./CustomerPicker";
import { useAuth } from "../../context/authStore";
import { useSubmit } from "../../hooks/useSubmit";
import { CURRENCIES, PAYMENT_STATUS, REGISTRATION_STATUS } from "../../utils/labels";
import "./forms.css";

// Add a customer to a tour, or edit an existing registration. Price and
// payment status are only offered with finance.update (the API refuses
// those fields otherwise). Payment status normally follows the recorded
// payments automatically; it's only sent when changed here explicitly.
function RegistrationFormModal({ tourId, registration, registeredIds = [], onClose, onSaved }) {
  const editing = Boolean(registration);
  const { can } = useAuth();
  const canEditPrice = can("finance.update");

  const [customer, setCustomer] = useState(null);
  const [values, setValues] = useState({
    status: registration?.status || "REGISTERED",
    room_number: registration?.room_number || "",
    special_requirements: registration?.special_requirements || "",
    notes: registration?.notes || "",
    sale_price: registration?.sale_price != null ? String(Number(registration.sale_price)) : "",
    sale_currency: registration?.sale_currency || "TRY",
    payment_status: registration?.payment_status || "UNPAID",
  });
  const { busy, error, setError, run } = useSubmit();
  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!editing && !customer) {
      setError("Bir müşteri seçin.");
      return;
    }
    if (canEditPrice && values.sale_price && !(Number(values.sale_price) > 0)) {
      setError("Satış fiyatı pozitif bir sayı olmalı.");
      return;
    }

    const payload = {
      status: values.status,
      room_number: values.room_number.trim() || null,
      special_requirements: values.special_requirements.trim() || null,
      notes: values.notes.trim() || null,
    };
    if (canEditPrice) {
      if (values.sale_price) {
        payload.sale_price = Number(values.sale_price);
        payload.sale_currency = values.sale_currency;
      } else if (editing && registration.sale_price != null) {
        payload.sale_price = null;
      }
      if (editing && values.payment_status !== registration.payment_status) {
        payload.payment_status = values.payment_status;
      }
    }

    const ok = await run(async () => {
      if (editing) {
        await apiClient.patch(`/tours/${tourId}/participants/${registration.participant_id}`, payload);
      } else {
        await apiClient.post(`/tours/${tourId}/participants`, { participant_id: customer.id, ...payload });
      }
    });
    if (ok) onSaved();
  }

  const title = editing ? `${registration.first_name} ${registration.last_name} · Kaydı Düzenle` : "Tura Müşteri Ekle";

  return (
    <Modal title={title} onClose={onClose}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {!editing && (
            <Field label="Müşteri" required className="span-2">
              {(id) => <CustomerPicker id={id} value={customer} onChange={setCustomer} excludeIds={registeredIds} />}
            </Field>
          )}
          <Field label="Kayıt durumu">
            {(id) => (
              <select id={id} className="select" value={values.status} onChange={set("status")}>
                {Object.entries(REGISTRATION_STATUS).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Oda no">
            {(id) => <input id={id} className="input" value={values.room_number} onChange={set("room_number")} maxLength={20} />}
          </Field>
          {canEditPrice && (
            <>
              <Field label="Satış fiyatı">
                {(id) => (
                  <input id={id} className="input" type="number" min="0" step="0.01" value={values.sale_price} onChange={set("sale_price")} />
                )}
              </Field>
              <Field label="Para birimi">
                {(id) => (
                  <select id={id} className="select" value={values.sale_currency} onChange={set("sale_currency")}>
                    {CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {editing && (
                <Field label="Ödeme durumu" className="span-2" hint="Normalde kayıtlı ödemelerden otomatik hesaplanır; yalnızca gerekirse elle değiştirin.">
                  {(id) => (
                    <select id={id} className="select" value={values.payment_status} onChange={set("payment_status")}>
                      {Object.entries(PAYMENT_STATUS).map(([value, { label }]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}
            </>
          )}
          <Field label="Özel istekler" className="span-2">
            {(id) => <textarea id={id} className="textarea" value={values.special_requirements} onChange={set("special_requirements")} />}
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
            {busy ? "Kaydediliyor..." : editing ? "Kaydet" : "Tura Ekle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default RegistrationFormModal;
