import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import Field from "../components/ui/Field";
import Pagination from "../components/ui/Pagination";
import StatusBadge from "../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import TourFormModal from "../components/forms/TourFormModal";
import { formatDate } from "../utils/date";
import { TOUR_STATUS, TOUR_STATUS_LABELS } from "../utils/tourStatus";

const PAGE_SIZE = 20;


function Tours() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const debouncedSearch = useDebouncedValue(search.trim());
  const params = { page, limit: PAGE_SIZE, search: debouncedSearch || undefined, status: status || undefined };
  const { data, loading, error, reload } = useApi(() => apiClient.get("/tours", { params }), JSON.stringify(params));
  const tours = data?.data || [];
  const filtered = Boolean(debouncedSearch || status);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Turlar</h1>
          <p className="page-subtitle">Tur organizasyonlarınızı yönetin.</p>
        </div>
        {can("tours.create") && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              + Yeni Tur
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
              placeholder="Tur adı veya destinasyon"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
        <Field label="Durum">
          {(id) => (
            <select
              id={id}
              className="select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tümü</option>
              {Object.entries(TOUR_STATUS_LABELS).map(([value, label]) => (
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
          <LoadingState label="Turlar yükleniyor..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : tours.length === 0 ? (
          <EmptyState
            title={filtered ? "Filtrelere uyan tur bulunamadı." : "Henüz tur bulunmuyor."}
            description={filtered ? "Arama veya filtreyi değiştirin." : "İlk turunuzu oluşturarak başlayın."}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tur</th>
                <th>Tarihler</th>
                <th className="num">Kapasite</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {tours.map((tour) => (
                <tr key={tour.id} className="row-link" onClick={() => navigate(`/tours/${tour.id}`)}>
                  <td className="cell-strong">
                    {tour.title}
                    <span className="cell-sub">{tour.destination}</span>
                  </td>
                  <td>
                    {formatDate(tour.start_date)} – {formatDate(tour.end_date)}
                  </td>
                  <td className="num">{tour.capacity != null ? `${tour.capacity} kişi` : "-"}</td>
                  <td>
                    <StatusBadge map={TOUR_STATUS} value={tour.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination pagination={data?.pagination} onPageChange={setPage} unit="tur" />

      {creating && (
        <TourFormModal
          tour={null}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            toast.success("Tur oluşturuldu.");
            navigate(`/tours/${saved.id}`);
          }}
        />
      )}
    </div>
  );
}

export default Tours;
