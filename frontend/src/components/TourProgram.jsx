import { useState } from "react";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import ConfirmDialog from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "./ui/States";
import DayFormModal from "./forms/DayFormModal";
import ActivityFormModal from "./forms/ActivityFormModal";
import { formatDate, formatTime } from "../utils/date";
import "./TourSections.css";

function timeRange(activity) {
  const start = formatTime(activity.start_time);
  const end = formatTime(activity.end_time);
  if (start && end) return `${start} – ${end}`;
  return start || (end ? `– ${end}` : "Saat yok");
}

// The tour's day-by-day program: days (ordered by day number) with
// their activities (ordered by start time), both as returned by the API.
// Two requests: the days, and all of the tour's activities at once.
function TourProgram({ tour }) {
  const { can } = useAuth();
  const toast = useToast();
  const days = useApi(() => apiClient.get(`/tours/${tour.id}/days`), `program-days-${tour.id}`);
  const activities = useApi(
    () => apiClient.get("/activities", { params: { tour: tour.id, limit: 100 } }),
    `program-activities-${tour.id}`
  );

  const [addingDay, setAddingDay] = useState(false);
  const [activityForm, setActivityForm] = useState(null); // null | { activity } | { dayTourId }
  const [confirm, setConfirm] = useState(null);

  const dayList = days.data?.data || [];
  const activityList = activities.data?.data || [];
  const byDay = new Map();
  for (const activity of activityList) {
    if (!byDay.has(activity.tour_day_id)) byDay.set(activity.tour_day_id, []);
    byDay.get(activity.tour_day_id).push(activity);
  }

  function reloadAll() {
    days.reload();
    activities.reload();
  }

  const loading = (days.loading && !days.data) || (activities.loading && !activities.data);
  const error = days.error || activities.error;

  return (
    <section className="card">
      <div className="section-head">
        <h2>Program</h2>
        <div className="page-actions">
          {can("activities.create") && dayList.length > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setActivityForm({ create: true })}>
              + Aktivite
            </button>
          )}
          {can("tours.update") && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setAddingDay(true)}>
              + Gün
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Program yükleniyor..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reloadAll} />
      ) : dayList.length === 0 ? (
        <EmptyState
          title="Bu tur için henüz gün planı oluşturulmamış."
          description={can("tours.update") ? "Gün ekleyerek programı oluşturmaya başlayın." : undefined}
        />
      ) : (
        <ol className="program">
          {dayList.map((day) => {
            const items = byDay.get(day.id) || [];
            return (
              <li key={day.id} className="program-day">
                <div className="program-day-head">
                  <span className="cell-strong">Gün {day.day_number}</span>
                  <span className="muted small">{formatDate(day.date)}</span>
                  {day.title && <span className="program-day-title">{day.title}</span>}
                  {can("tours.update") && (
                    <button
                      type="button"
                      className="btn-link danger small program-day-delete"
                      onClick={() =>
                        setConfirm({
                          title: "Günü sil",
                          message: `Gün ${day.day_number} ve bu güne ait tüm aktiviteler silinecek.`,
                          run: () => apiClient.delete(`/tours/${tour.id}/days/${day.id}`),
                          done: "Gün silindi.",
                        })
                      }
                    >
                      Günü sil
                    </button>
                  )}
                </div>
                {day.description && <p className="program-day-description">{day.description}</p>}
                {items.length === 0 ? (
                  <p className="muted small program-empty">Bu gün için aktivite yok.</p>
                ) : (
                  <ul className="program-activities">
                    {items.map((activity) => (
                      <li key={activity.id} className="program-activity">
                        <span className="program-time">{timeRange(activity)}</span>
                        <div className="program-activity-body">
                          <span className="cell-strong">{activity.title}</span>
                          {activity.location && <span className="muted small">{activity.location}</span>}
                          {activity.description && <span className="small">{activity.description}</span>}
                        </div>
                        <div className="program-activity-actions">
                          {can("activities.update") && (
                            <button type="button" className="btn-link small" onClick={() => setActivityForm({ activity })}>
                              Düzenle
                            </button>
                          )}
                          {can("activities.delete") && (
                            <button
                              type="button"
                              className="btn-link danger small"
                              onClick={() =>
                                setConfirm({
                                  title: "Aktiviteyi sil",
                                  message: `"${activity.title}" silinecek.`,
                                  run: () => apiClient.delete(`/activities/${activity.id}`),
                                  done: "Aktivite silindi.",
                                })
                              }
                            >
                              Sil
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {addingDay && (
        <DayFormModal
          tour={tour}
          existingDays={dayList}
          onClose={() => setAddingDay(false)}
          onSaved={() => {
            setAddingDay(false);
            toast.success("Gün eklendi.");
            days.reload();
          }}
        />
      )}

      {activityForm && (
        <ActivityFormModal
          activity={activityForm.activity || null}
          tourId={tour.id}
          onClose={() => setActivityForm(null)}
          onSaved={() => {
            const created = !activityForm.activity;
            setActivityForm(null);
            toast.success(created ? "Aktivite eklendi." : "Aktivite güncellendi.");
            activities.reload();
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={async () => {
            await confirm.run();
            toast.success(confirm.done);
            reloadAll();
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </section>
  );
}

export default TourProgram;
