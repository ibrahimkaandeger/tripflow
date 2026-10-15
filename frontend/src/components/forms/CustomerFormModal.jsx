import { useState } from "react";
import apiClient from "../../services/apiClient";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import { useSubmit } from "../../hooks/useSubmit";
import { toPayload } from "../../utils/formPayload";
import { toInputDate } from "../../utils/date";
import { CUSTOMER_STATUS } from "../../utils/labels";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Create or edit a customer (participant). `customer` null = create.
function CustomerFormModal({ customer, onClose, onSaved }) {
  const editing = Boolean(customer);
  const [values, setValues] = useState({
    first_name: customer?.first_name || "",
    last_name: customer?.last_name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    birth_date: toInputDate(customer?.birth_date),
    city: customer?.city || "",
    passport_number: customer?.passport_number || "",
    passport_country: customer?.passport_country || "",
    status: customer?.status || "ACTIVE",
    notes: customer?.notes || "",
  });
  const { busy, error, setError, run } = useSubmit();

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values.first_name.trim() || !values.last_name.trim()) {
      setError("Ad ve soyad zorunludur.");
      return;
    }
    if (!values.email.trim() && !values.phone.trim()) {
      setError("E-posta veya telefon alanlarından en az biri zorunludur.");
      return;
    }
    if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }

    const payload = toPayload(values, { editing });
    let saved;
    const ok = await run(async () => {
      const response = editing
        ? await apiClient.patch(`/participants/${customer.id}`, payload)
        : await apiClient.post("/participants", payload);
      saved = response.data.data;
    });
    if (ok) onSaved(saved);
  }

  return (
    <Modal title={editing ? "Müşteriyi Düzenle" : "Yeni Müşteri"} onClose={onClose}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <Field label="Ad" required>
            {(id) => <input id={id} className="input" value={values.first_name} onChange={set("first_name")} maxLength={100} />}
          </Field>
          <Field label="Soyad" required>
            {(id) => <input id={id} className="input" value={values.last_name} onChange={set("last_name")} maxLength={100} />}
          </Field>
          <Field label="E-posta" hint="E-posta veya telefondan biri zorunlu.">
            {(id) => <input id={id} className="input" type="email" value={values.email} onChange={set("email")} />}
          </Field>
          <Field label="Telefon">
            {(id) => <input id={id} className="input" type="tel" value={values.phone} onChange={set("phone")} maxLength={50} />}
          </Field>
          <Field label="Doğum tarihi">
            {(id) => <input id={id} className="input" type="date" value={values.birth_date} onChange={set("birth_date")} />}
          </Field>
          <Field label="Şehir">
            {(id) => <input id={id} className="input" value={values.city} onChange={set("city")} maxLength={100} />}
          </Field>
          <Field label="Pasaport no">
            {(id) => (
              <input id={id} className="input" value={values.passport_number} onChange={set("passport_number")} maxLength={50} />
            )}
          </Field>
          <Field label="Pasaport ülkesi">
            {(id) => (
              <input id={id} className="input" value={values.passport_country} onChange={set("passport_country")} maxLength={100} />
            )}
          </Field>
          {editing && (
            <Field label="Durum">
              {(id) => (
                <select id={id} className="select" value={values.status} onChange={set("status")}>
                  {Object.entries(CUSTOMER_STATUS).map(([value, { label }]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Notlar" className="span-2">
            {(id) => <textarea id={id} className="textarea" value={values.notes} onChange={set("notes")} />}
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Kaydediliyor..." : editing ? "Kaydet" : "Müşteri Ekle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default CustomerFormModal;
