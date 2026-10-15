import { useState } from "react";
import apiClient from "../../services/apiClient";
import Modal from "../ui/Modal";
import Field from "../ui/Field";
import TourSelect from "./TourSelect";
import { useSubmit } from "../../hooks/useSubmit";
import { ANNOUNCEMENT_PRIORITY } from "../../utils/labels";

// Create or edit an announcement. New announcements start as drafts;
// publishing is a separate action on the list.
function AnnouncementFormModal({ announcement, onClose, onSaved }) {
  const editing = Boolean(announcement);
  const [selectedTour, setSelectedTour] = useState("");
  const [values, setValues] = useState({
    title: announcement?.title || "",
    content: announcement?.content || "",
    priority: announcement?.priority || "NORMAL",
  });
  const { busy, error, setError, run } = useSubmit();
  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!editing && !selectedTour) {
      setError("Bir tur seçin.");
      return;
    }
    if (!values.title.trim() || !values.content.trim()) {
      setError("Başlık ve içerik zorunludur.");
      return;
    }

    const payload = { title: values.title.trim(), content: values.content.trim(), priority: values.priority };
    let saved;
    const ok = await run(async () => {
      const response = editing
        ? await apiClient.patch(`/announcements/${announcement.id}`, payload)
        : await apiClient.post(`/tours/${selectedTour}/announcements`, payload);
      saved = response.data.data;
    });
    if (ok) onSaved(saved);
  }

  return (
    <Modal title={editing ? "Duyuruyu Düzenle" : "Yeni Duyuru"} onClose={onClose}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {!editing && (
            <Field label="Tur" required>
              {(id) => <TourSelect id={id} value={selectedTour} onChange={setSelectedTour} />}
            </Field>
          )}
          <Field label="Öncelik" className={editing ? "span-2" : ""}>
            {(id) => (
              <select id={id} className="select" value={values.priority} onChange={set("priority")}>
                {Object.entries(ANNOUNCEMENT_PRIORITY).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Başlık" required className="span-2">
            {(id) => <input id={id} className="input" value={values.title} onChange={set("title")} maxLength={200} />}
          </Field>
          <Field label="İçerik" required className="span-2">
            {(id) => <textarea id={id} className="textarea" rows={6} value={values.content} onChange={set("content")} />}
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Kaydediliyor..." : editing ? "Kaydet" : "Taslak Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default AnnouncementFormModal;
