import { Link, useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useApi } from "../hooks/useApi";
import StatusBadge from "../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { ANNOUNCEMENT_PRIORITY } from "../utils/labels";
import { formatDate, formatDateTime } from "../utils/date";
import { formatMoney } from "../utils/money";
import { TOUR_STATUS, TOUR_STATUS_LABELS } from "../utils/tourStatus";
import "./Dashboard.css";

// One line per currency ("12.500 TRY", "800 EUR"); amounts in different
// currencies are never added together.
function MoneyLines({ items, field, empty = "-" }) {
  const lines = items.filter((item) => Number(item[field]) !== 0);
  if (lines.length === 0) return <span>{empty}</span>;
  return (
    <span className="stat-lines">
      {lines.map((item) => (
        <span key={item.currency}>{formatMoney(item[field], item.currency)}</span>
      ))}
    </span>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const summary = useApi(() => apiClient.get("/dashboard/summary"), "dashboard-summary");
  const unread = useApi(() => apiClient.get("/announcements/unread"), "dashboard-unread");

  const data = summary.data?.data;
  const announcements = unread.data?.data || [];
  const finance = data?.finance;
  // Revenue = completed income minus refunds, per currency.
  const revenue = finance?.totals.map((t) => ({ currency: t.currency, value: (Number(t.income) - Number(t.refund)).toFixed(2) })) || [];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Hoş geldin, {user?.name}</h1>
          <p className="page-subtitle">Operasyonlarınızın güncel özeti.</p>
        </div>
        <div className="page-actions">
          {can("participants.create") && (
            <Link className="btn" to="/customers">
              Müşteriler
            </Link>
          )}
          {can("tours.create") && (
            <Link className="btn btn-primary" to="/tours">
              Turlar
            </Link>
          )}
        </div>
      </header>

      {summary.loading && !data ? (
        <LoadingState label="Özet yükleniyor..." />
      ) : summary.error ? (
        <ErrorState message={summary.error} onRetry={summary.reload} />
      ) : data ? (
        <>
          <section className="stat-grid">
            <div className="stat">
              <span className="stat-label">Toplam Müşteri</span>
              <span className="stat-value">{data.customers.total}</span>
              <span className="stat-sub">{data.customers.active} aktif</span>
            </div>
            <div className="stat">
              <span className="stat-label">Aktif Tur</span>
              <span className="stat-value">{data.tours.active}</span>
              <span className="stat-sub">Bugün devam eden</span>
            </div>
            <div className="stat">
              <span className="stat-label">Yaklaşan Tur</span>
              <span className="stat-value">{data.tours.upcoming}</span>
              <span className="stat-sub">Toplam {data.tours.total} tur</span>
            </div>
            <div className="stat">
              <span className="stat-label">Tur Kayıtları</span>
              <span className="stat-value">{data.registrations}</span>
              <span className="stat-sub">İptal edilmemiş kayıt</span>
            </div>
          </section>

          {finance && (
            <section className="stat-grid dashboard-finance">
              <div className="stat">
                <span className="stat-label">Gelir (tahsil edilen)</span>
                <MoneyLines items={revenue} field="value" empty="Henüz gelir yok" />
              </div>
              <div className="stat">
                <span className="stat-label">Bekleyen Tahsilat</span>
                <MoneyLines items={finance.outstanding} field="amount" empty="Bekleyen tahsilat yok" />
              </div>
              <div className="stat">
                <span className="stat-label">Net Sonuç</span>
                <MoneyLines items={finance.totals} field="net" />
                <span className="stat-sub">Gelir − gider − iade</span>
              </div>
            </section>
          )}

          <div className="dashboard-columns">
            <section className="card">
              <div className="section-head">
                <h2>Yaklaşan ve Devam Eden Turlar</h2>
                <Link to="/tours" className="small">
                  Tümü →
                </Link>
              </div>
              {data.upcoming_tours.length === 0 ? (
                <EmptyState title="Yaklaşan tur yok." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tur</th>
                        <th>Tarihler</th>
                        <th className="num">Doluluk</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcoming_tours.map((tour) => (
                        <tr key={tour.id} className="row-link" onClick={() => navigate(`/tours/${tour.id}`)}>
                          <td className="cell-strong">
                            {tour.title}
                            <span className="cell-sub">{tour.destination}</span>
                          </td>
                          <td>
                            {formatDate(tour.start_date)} – {formatDate(tour.end_date)}
                          </td>
                          <td className="num">
                            {tour.participant_count}
                            {tour.capacity ? ` / ${tour.capacity}` : ""}
                          </td>
                          <td>
                            <StatusBadge map={TOUR_STATUS} value={tour.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card">
              <h2>Tur Durumları</h2>
              {data.tours.total === 0 ? (
                <EmptyState title="Henüz tur yok." />
              ) : (
                <ul className="status-bars">
                  {Object.keys(TOUR_STATUS_LABELS).map((status) => {
                    const count = data.tours.by_status[status] || 0;
                    return (
                      <li key={status}>
                        <span className="status-bar-label">{TOUR_STATUS_LABELS[status]}</span>
                        <span className="status-bar-track" aria-hidden="true">
                          <span className="status-bar-fill" style={{ width: `${(count / data.tours.total) * 100}%` }} />
                        </span>
                        <span className="status-bar-count">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}

      <section className="card dashboard-announcements">
        <h2>Okunmamış Duyurular</h2>
        {unread.loading && !unread.data ? (
          <LoadingState />
        ) : unread.error ? (
          <ErrorState message={unread.error} onRetry={unread.reload} />
        ) : announcements.length === 0 ? (
          <p className="muted">Okunmamış duyuru bulunmuyor.</p>
        ) : (
          <ul className="announcement-list">
            {announcements.map((announcement) => (
              <li key={`${announcement.scope}-${announcement.id}`}>
                <span className="cell-strong">{announcement.title}</span>
                <span className="muted small">{formatDateTime(announcement.published_at)}</span>
                <StatusBadge map={ANNOUNCEMENT_PRIORITY} value={announcement.priority} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
