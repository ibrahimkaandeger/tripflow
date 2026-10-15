import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import StatusBadge from "../components/ui/StatusBadge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { ErrorState, LoadingState } from "../components/ui/States";
import TourFormModal from "../components/forms/TourFormModal";
import TourProgram from "../components/TourProgram";
import TourParticipants from "../components/TourParticipants";
import TourFlights from "../components/TourFlights";
import TourHotels from "../components/TourHotels";
import TourFinance from "../components/TourFinance";
import { formatDate, formatDateTime } from "../utils/date";
import { TOUR_STATUS } from "../utils/tourStatus";
import { isValidId } from "../utils/ids";
import "./TourDetail.css";

const TABS = [
  { key: "overview", label: "Genel Bakış" },
  { key: "program", label: "Program", permission: "activities.read" },
  { key: "participants", label: "Katılımcılar", permission: "participants.read" },
  { key: "flights", label: "Uçuşlar", permission: "flights.read" },
  { key: "hotels", label: "Oteller", permission: "hotels.read" },
  { key: "finance", label: "Finans", permission: "finance.read" },
];

function TourDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const validId = isValidId(id);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, reload } = useApi(() => apiClient.get(`/tours/${id}`), validId ? `tour-${id}` : null, {
    notFound: "Tur bulunamadı.",
  });
  const tour = data?.data;

  const tabs = TABS.filter((tab) => !tab.permission || can(tab.permission));
  const activeTab = tabs.some((tab) => tab.key === searchParams.get("tab")) ? searchParams.get("tab") : "overview";

  if (!validId) {
    return (
      <div className="page">
        <Link to="/tours" className="back-link">
          ← Turlara Dön
        </Link>
        <ErrorState message="Tur bulunamadı." />
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/tours" className="back-link">
        ← Turlara Dön
      </Link>

      {loading && !tour ? (
        <LoadingState label="Tur yükleniyor..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : tour ? (
        <>
          <header className="page-header">
            <div>
              <h1>{tour.title}</h1>
              <p className="page-subtitle">
                {tour.destination} · {formatDate(tour.start_date)} – {formatDate(tour.end_date)}{" "}
                <StatusBadge map={TOUR_STATUS} value={tour.status} />
              </p>
            </div>
            <div className="page-actions">
              {can("tours.update") && (
                <button type="button" className="btn" onClick={() => setEditing(true)}>
                  Düzenle
                </button>
              )}
              {can("tours.delete") && (
                <button type="button" className="btn btn-danger" onClick={() => setDeleting(true)}>
                  Sil
                </button>
              )}
            </div>
          </header>

          <nav className="tabs" role="tablist" aria-label="Tur bölümleri">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={activeTab === tab.key ? "tab tab-active" : "tab"}
                onClick={() => setSearchParams(tab.key === "overview" ? {} : { tab: tab.key }, { replace: true })}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "overview" && (
            <>
              <section className="card">
                <h2>Özet</h2>
                <dl className="detail-grid">
                  <div>
                    <dt>Destinasyon</dt>
                    <dd>{tour.destination}</dd>
                  </div>
                  <div>
                    <dt>Başlangıç</dt>
                    <dd>{formatDate(tour.start_date)}</dd>
                  </div>
                  <div>
                    <dt>Bitiş</dt>
                    <dd>{formatDate(tour.end_date)}</dd>
                  </div>
                  <div>
                    <dt>Durum</dt>
                    <dd>
                      <StatusBadge map={TOUR_STATUS} value={tour.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>Kapasite</dt>
                    <dd>{tour.capacity != null ? `${tour.capacity} kişi` : "Belirtilmemiş"}</dd>
                  </div>
                </dl>
              </section>
              <section className="card">
                <h2>Açıklama</h2>
                {tour.description ? <p className="notes-block">{tour.description}</p> : <p className="muted">Açıklama bulunmuyor.</p>}
                <p className="muted small tour-meta">
                  Oluşturulma: {formatDateTime(tour.created_at)} · Son güncelleme: {formatDateTime(tour.updated_at)}
                </p>
              </section>
              <section className="card">
                <h2>İlgili kayıtlar</h2>
                <div className="page-actions">
                  {can("documents.read") && (
                    <Link className="btn" to={`/documents?tour=${tour.id}`}>
                      Belgeler
                    </Link>
                  )}
                  {can("announcements.read") && (
                    <Link className="btn" to={`/announcements?tour=${tour.id}`}>
                      Duyurular
                    </Link>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === "program" && <TourProgram tour={tour} />}
          {activeTab === "participants" && <TourParticipants tourId={tour.id} capacity={tour.capacity} />}
          {activeTab === "flights" && <TourFlights tourId={tour.id} />}
          {activeTab === "hotels" && <TourHotels tourId={tour.id} />}
          {activeTab === "finance" && <TourFinance tourId={tour.id} />}
        </>
      ) : null}

      {editing && tour && (
        <TourFormModal
          tour={tour}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success("Tur güncellendi.");
            reload();
          }}
        />
      )}

      {deleting && tour && (
        <ConfirmDialog
          title="Turu sil"
          message={`"${tour.title}" ve tüm programı, uçuşları, otelleri, belgeleri ve katılımcı kayıtları silinecek. Finansal kaydı olan turlar silinemez.`}
          onConfirm={async () => {
            await apiClient.delete(`/tours/${tour.id}`);
            toast.success("Tur silindi.");
            navigate("/tours", { replace: true });
          }}
          onClose={() => setDeleting(false)}
        />
      )}
    </div>
  );
}

export default TourDetail;
