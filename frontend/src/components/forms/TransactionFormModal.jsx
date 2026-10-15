import { useState } from "react";
import apiClient from "../../services/apiClient";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import TourSelect from "./TourSelect";
import { useApi } from "../../hooks/useApi";
import { useSubmit } from "../../hooks/useSubmit";
import { toInputDate, todayInputDate } from "../../utils/date";
import { CATEGORY_LABELS, CURRENCIES, TRANSACTION_CATEGORIES, TRANSACTION_TYPE } from "../../utils/labels";

// Record a payment / expense / refund, or edit one. Type and currency
// are fixed once recorded (the API rejects changing them); cancelling
// is a separate action, never an edit.
function TransactionFormModal({ transaction, tourId, onClose, onSaved }) {
  const editing = Boolean(transaction);
  const [selectedTour, setSelectedTour] = useState(tourId ? String(tourId) : "");
  const [values, setValues] = useState({
    type: transaction?.type || "INCOME",
    category: transaction?.category || "PARTICIPANT_PAYMENT",
    amount: transaction ? String(Number(transaction.amount)) : "",
    currency: transaction?.currency || "TRY",
    transaction_date: transaction ? toInputDate(transaction.transaction_date) : todayInputDate(),
    status: transaction?.status === "COMPLETED" ? "COMPLETED" : transaction ? "PENDING" : "COMPLETED",
    participant_id: transaction?.participant_id ? String(transaction.participant_id) : "",
    description: transaction?.description || "",
    reference_number: transaction?.reference_number || "",
  });
  const { busy, error, setError, run } = useSubmit();

  // Payments/refunds can be tied to a customer registered on the tour.
  const participantAllowed = values.type !== "EXPENSE";
  const registrations = useApi(
    () => apiClient.get(`/tours/${selectedTour}/participants`),
    !editing && selectedTour && participantAllowed ? `registrations-${selectedTour}` : null
  );

  function set(field) {
    return (event) => {
      const value = event.target.value;
      setValues((current) => {
        const next = { ...current, [field]: value };
        if (field === "type") {
          next.category = TRANSACTION_CATEGORIES[value][0];
          if (value === "EXPENSE") next.participant_id = "";
        }
        return next;
      });
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!editing && !selectedTour) {
      setError("Bir tur seçin.");
      return;
    }
    if (!(Number(values.amount) > 0)) {
      setError("Tutar pozitif bir sayı olmalı.");
      return;
    }
    if (!values.transaction_date) {
      setError("İşlem tarihi zorunludur.");
      return;
    }

    const common = {
      category: values.category,
      amount: Number(values.amount),
      status: values.status,
      transaction_date: values.transaction_date,
      description: values.description.trim() || null,
      reference_number: values.reference_number.trim() || null,
    };

    let saved;
    const ok = await run(async () => {
      if (editing) {
        saved = (await apiClient.patch(`/finance/transactions/${transaction.id}`, common)).data.data;
      } else {
        const payload = { ...common, type: values.type, currency: values.currency };
        if (values.participant_id) payload.participant_id = Number(values.participant_id);
        saved = (await apiClient.post(`/tours/${selectedTour}/finance`, payload)).data.data;
      }
    });
    if (ok) onSaved(saved);
  }

  return (
    <Modal title={editing ? "Finansal İşlemi Düzenle" : "Yeni Finansal İşlem"} onClose={onClose}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {!editing && !tourId && (
            <Field label="Tur" required className="span-2">
              {(id) => (
                <TourSelect
                  id={id}
                  value={selectedTour}
                  onChange={(value) => {
                    setSelectedTour(value);
                    setValues((v) => ({ ...v, participant_id: "" }));
                  }}
                />
              )}
            </Field>
          )}
          <Field label="Tür" required>
            {(id) => (
              <select id={id} className="select" value={values.type} onChange={set("type")} disabled={editing}>
                {Object.entries(TRANSACTION_TYPE).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Kategori" required>
            {(id) => (
              <select id={id} className="select" value={values.category} onChange={set("category")}>
                {TRANSACTION_CATEGORIES[values.type].map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Tutar" required>
            {(id) => (
              <input id={id} className="input" type="number" min="0" step="0.01" value={values.amount} onChange={set("amount")} />
            )}
          </Field>
          <Field label="Para birimi" required hint={editing ? "Kayıttan sonra değiştirilemez." : undefined}>
            {(id) => (
              <select id={id} className="select" value={values.currency} onChange={set("currency")} disabled={editing}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="İşlem tarihi" required>
            {(id) => <input id={id} className="input" type="date" value={values.transaction_date} onChange={set("transaction_date")} />}
          </Field>
          <Field label="Durum">
            {(id) => (
              <select id={id} className="select" value={values.status} onChange={set("status")}>
                <option value="COMPLETED">Tamamlandı</option>
                <option value="PENDING">Beklemede</option>
              </select>
            )}
          </Field>
          {!editing && participantAllowed && (
            <Field label="Müşteri" className="span-2" hint="Katılımcı ödemesi veya iadesi ise ilgili müşteriyi seçin.">
              {(id) => (
                <select
                  id={id}
                  className="select"
                  value={values.participant_id}
                  onChange={set("participant_id")}
                  disabled={!selectedTour || registrations.loading}
                >
                  <option value="">{registrations.loading ? "Yükleniyor..." : "Müşteri yok"}</option>
                  {(registrations.data?.data || []).map((row) => (
                    <option key={row.participant_id} value={String(row.participant_id)}>
                      {row.first_name} {row.last_name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Referans no">
            {(id) => <input id={id} className="input" value={values.reference_number} onChange={set("reference_number")} maxLength={50} />}
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
            {busy ? "Kaydediliyor..." : editing ? "Kaydet" : "İşlemi Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default TransactionFormModal;
