import { useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import { useListFilters } from "../hooks/useListFilters";
import Field from "../components/ui/Field";
import Pagination from "../components/ui/Pagination";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import TourSelect from "../components/forms/TourSelect";
import ActivityFormModal from "../components/forms/ActivityFormModal";
import { formatDate, formatTime } from "../utils/date";

function Activities() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useListFilters();
  const { data, loading, error, reload } = useApi(
    () => apiClient.get("/activities", { params: list.params }),
    JSON.stringify(list.params)
  );
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const activities = data?.data || [];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Aktiviteler</h1>
          <p className="page-subtitle">Tur programlarındaki tüm aktiviteler, gün ve saat sırasıyla.</p>
        </div>
        {can("activities.create") && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setForm({})}>
              + Yeni Aktivite
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
              placeholder="Aktivite adı veya konum"
              value={list.search}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          )}
        </Field>
        <Field label="Tur">{(id) => <TourSelect id={id} value={list.tour} onChange={list.setTour} allowAll />}</Field>
      </div>

      <div className="table-wrap">
        {loading && !data ? (
          <LoadingState label="Aktiviteler yükleniyor..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : activities.length === 0 ? (
          <EmptyState
            title={list.isFiltered ? "Filtrelere uyan aktivite bulunamadı." : "Henüz aktivite eklenmemiş."}
            description={list.isFiltered ? undefined : "Aktiviteler bir turun program günlerine eklenir."}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Aktivite</th>
                <th>Tur</th>
                <th>Gün</th>
                <th>Saat</th>
                <th aria-label="İşlemler" />
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.id}>
                  <td className="cell-strong">
                    {activity.title}
                    {activity.location && <span className="cell-sub">{activity.location}</span>}
                  </td>
                  <td>
                    <Link to={`/tours/${activity.tour_id}?tab=program`}>{activity.tour_title}</Link>
                  </td>
                  <td>
                    Gün {activity.day_number}
                    <span className="cell-sub">{formatDate(activity.day_date)}</span>
                  </td>
                  <td>
                    {formatTime(activity.start_time) || "-"}
                    {activity.end_time && ` – ${formatTime(activity.end_time)}`}
                  </td>
                  <td className="cell-actions">
                    {can("activities.update") && (
                      <button type="button" className="btn-link" onClick={() => setForm({ activity })}>
                        Düzenle
                      </button>
                    )}
                    {can("activities.delete") && (
                      <button type="button" className="btn-link danger" onClick={() => setDeleting(activity)}>
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination pagination={data?.pagination} onPageChange={list.setPage} unit="aktivite" />

      {form && (
        <ActivityFormModal
          activity={form.activity || null}
          onClose={() => setForm(null)}
          onSaved={() => {
            const created = !form.activity;
            setForm(null);
            toast.success(created ? "Aktivite eklendi." : "Aktivite güncellendi.");
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Aktiviteyi sil"
          message={`"${deleting.title}" silinecek.`}
          onConfirm={async () => {
            await apiClient.delete(`/activities/${deleting.id}`);
            toast.success("Aktivite silindi.");
            reload();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

export default Activities;
