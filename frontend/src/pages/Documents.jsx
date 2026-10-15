import { useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import { useListFilters } from "../hooks/useListFilters";
import Field from "../components/ui/Field";
import Pagination from "../components/ui/Pagination";
import StatusBadge from "../components/ui/StatusBadge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import TourSelect from "../components/forms/TourSelect";
import DocumentFormModal from "../components/forms/DocumentFormModal";
import { DOCUMENT_CATEGORY, DOCUMENT_STATUS, DOCUMENT_VISIBILITY } from "../utils/labels";
import { formatDate } from "../utils/date";

// Only http(s) links are ever rendered as clickable (the API enforces
// this too); anything else is shown as plain text.
function safeHref(url) {
  return /^https?:\/\//i.test(url || "") ? url : null;
}

function Documents() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useListFilters({ status: "" });
  const { data, loading, error, reload } = useApi(
    () => apiClient.get("/documents", { params: list.params }),
    JSON.stringify(list.params)
  );
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const documents = data?.data || [];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Belgeler</h1>
          <p className="page-subtitle">Pasaport, bilet, vize ve program belgelerinin bağlantıları.</p>
        </div>
        {can("documents.create") && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setForm({})}>
              + Yeni Belge
            </button>
          </div>
        )}
      </header>

      <div className="toolbar">
        <Field label="Ara" className="field-grow">
          {(id) => (
            <input
              id={id}
              className="input"
              type="search"
              placeholder="Başlık veya dosya adı"
              value={list.search}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          )}
        </Field>
        <Field label="Tur">{(id) => <TourSelect id={id} value={list.tour} onChange={list.setTour} allowAll />}</Field>
        <Field label="Durum">
          {(id) => (
            <select id={id} className="select" value={list.filters.status} onChange={(event) => list.setFilter("status", event.target.value)}>
              <option value="">Tümü</option>
              {Object.entries(DOCUMENT_STATUS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <div className="table-wrap">
        {loading && !data ? (
          <LoadingState label="Belgeler yükleniyor..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : documents.length === 0 ? (
          <EmptyState title={list.isFiltered ? "Filtrelere uyan belge bulunamadı." : "Henüz belge eklenmemiş."} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Belge</th>
                <th>Tur</th>
                <th>Müşteri</th>
                <th>Görünürlük</th>
                <th>Durum</th>
                <th>Eklenme</th>
                <th aria-label="İşlemler" />
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => {
                const href = safeHref(document.file_url);
                return (
                  <tr key={document.id}>
                    <td>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="cell-strong">
                          {document.title}
                        </a>
                      ) : (
                        <span className="cell-strong">{document.title}</span>
                      )}
                      <span className="cell-sub">
                        {DOCUMENT_CATEGORY[document.category] || document.category} · {document.file_name}
                      </span>
                    </td>
                    <td>
                      <Link to={`/tours/${document.tour_id}`}>{document.tour_title}</Link>
                    </td>
                    <td>
                      {document.participant_id
                        ? `${document.participant_first_name} ${document.participant_last_name}`
                        : <span className="muted">Genel</span>}
                    </td>
                    <td>{DOCUMENT_VISIBILITY[document.visibility] || document.visibility}</td>
                    <td>
                      <StatusBadge map={DOCUMENT_STATUS} value={document.status} />
                    </td>
                    <td>{formatDate(document.created_at)}</td>
                    <td className="cell-actions">
                      {can("documents.update") && (
                        <button type="button" className="btn-link" onClick={() => setForm({ document })}>
                          Düzenle
                        </button>
                      )}
                      {can("documents.delete") && (
                        <button type="button" className="btn-link danger" onClick={() => setDeleting(document)}>
                          Sil
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination pagination={data?.pagination} onPageChange={list.setPage} unit="belge" />

      {form && (
        <DocumentFormModal
          document={form.document || null}
          onClose={() => setForm(null)}
          onSaved={() => {
            const created = !form.document;
            setForm(null);
            toast.success(created ? "Belge eklendi." : "Belge güncellendi.");
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Belgeyi sil"
          message={`"${deleting.title}" kaydı silinecek. Dosyanın kendisi kendi depolama alanınızda kalır.`}
          onConfirm={async () => {
            await apiClient.delete(`/documents/${deleting.id}`);
            toast.success("Belge silindi.");
            reload();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

export default Documents;
