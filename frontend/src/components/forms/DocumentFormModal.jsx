import { useState } from "react";
import apiClient from "../../services/apiClient";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import TourSelect from "./TourSelect";
import { useApi } from "../../hooks/useApi";
import { useSubmit } from "../../hooks/useSubmit";
import { toPayload } from "../../utils/formPayload";
import { DOCUMENT_CATEGORY, DOCUMENT_STATUS, DOCUMENT_VISIBILITY } from "../../utils/labels";

// Document metadata: TripFlow stores the link and details, the file
// itself lives in the company's own storage (drive, S3, ...).
function DocumentFormModal({ document, onClose, onSaved }) {
  const editing = Boolean(document);
  const [selectedTour, setSelectedTour] = useState("");
  const [values, setValues] = useState({
    title: document?.title || "",
    category: document?.category || "PROGRAM",
    file_name: document?.file_name || "",
    file_url: document?.file_url || "",
    visibility: document?.visibility || "COMPANY_ONLY",
    status: document?.status || "ACTIVE",
    participant_id: "",
    description: document?.description || "",
  });
  const { busy, error, setError, run } = useSubmit();

  const registrations = useApi(
    () => apiClient.get(`/tours/${selectedTour}/participants`),
    !editing && selectedTour ? `doc-registrations-${selectedTour}` : null
  );

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!editing && !selectedTour) {
      setError("Bir tur seçin.");
      return;
    }
    if (!values.title.trim() || !values.file_name.trim() || !values.file_url.trim()) {
      setError("Başlık, dosya adı ve bağlantı zorunludur.");
      return;
    }
    if (!/^https?:\/\//i.test(values.file_url.trim())) {
      setError("Bağlantı http:// veya https:// ile başlamalı.");
      return;
    }

    const { participant_id, ...rest } = values;
    const payload = toPayload(rest, { editing });
    if (!editing && participant_id) payload.participant_id = Number(participant_id);

    let saved;
    const ok = await run(async () => {
      const response = editing
        ? await apiClient.patch(`/documents/${document.id}`, payload)
        : await apiClient.post(`/tours/${selectedTour}/documents`, payload);
      saved = response.data.data;
    });
    if (ok) onSaved(saved);
  }

  return (
    <Modal title={editing ? "Belgeyi Düzenle" : "Yeni Belge"} onClose={onClose}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {!editing && (
            <>
              <Field label="Tur" required>
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
              <Field label="Müşteri" hint="Kişiye özel belgeyse seçin.">
                {(id) => (
                  <select
                    id={id}
                    className="select"
                    value={values.participant_id}
                    onChange={set("participant_id")}
                    disabled={!selectedTour || registrations.loading}
                  >
                    <option value="">Genel (tüm tur)</option>
                    {(registrations.data?.data || []).map((row) => (
                      <option key={row.participant_id} value={String(row.participant_id)}>
                        {row.first_name} {row.last_name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </>
          )}
          <Field label="Başlık" required className="span-2">
            {(id) => <input id={id} className="input" value={values.title} onChange={set("title")} maxLength={200} />}
          </Field>
          <Field label="Kategori">
            {(id) => (
              <select id={id} className="select" value={values.category} onChange={set("category")}>
                {Object.entries(DOCUMENT_CATEGORY).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Görünürlük">
            {(id) => (
              <select id={id} className="select" value={values.visibility} onChange={set("visibility")}>
                {Object.entries(DOCUMENT_VISIBILITY).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Dosya adı" required>
            {(id) => <input id={id} className="input" value={values.file_name} onChange={set("file_name")} maxLength={255} placeholder="program.pdf" />}
          </Field>
          {editing && (
            <Field label="Durum">
              {(id) => (
                <select id={id} className="select" value={values.status} onChange={set("status")}>
                  {Object.entries(DOCUMENT_STATUS).map(([value, { label }]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Bağlantı (URL)" required className="span-2" hint="Dosyanın saklandığı adres (https://...).">
            {(id) => <input id={id} className="input" type="url" value={values.file_url} onChange={set("file_url")} />}
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
            {busy ? "Kaydediliyor..." : editing ? "Kaydet" : "Belge Ekle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default DocumentFormModal;
