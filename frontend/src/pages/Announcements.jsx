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
import AnnouncementFormModal from "../components/forms/AnnouncementFormModal";
import { ANNOUNCEMENT_PRIORITY, ANNOUNCEMENT_STATUS } from "../utils/labels";
import { formatDateTime } from "../utils/date";

function Announcements() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useListFilters({ status: "" });
  const { data, loading, error, reload } = useApi(
    () => apiClient.get("/announcements", { params: list.params }),
    JSON.stringify(list.params)
  );
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const announcements = data?.data || [];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Duyurular</h1>
          <p className="page-subtitle">Tur katılımcıları ve ekibiniz için duyurular. Taslaklar yayınlanana kadar görünmez.</p>
        </div>
        {can("announcements.create") && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setForm({})}>
              + Yeni Duyuru
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
              placeholder="Duyuru başlığı"
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
              {Object.entries(ANNOUNCEMENT_STATUS).map(([value, { label }]) => (
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
          <LoadingState label="Duyurular yükleniyor..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : announcements.length === 0 ? (
          <EmptyState title={list.isFiltered ? "Filtrelere uyan duyuru bulunamadı." : "Henüz duyuru yok."} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Duyuru</th>
                <th>Tur</th>
                <th>Öncelik</th>
                <th>Durum</th>
                <th>Yayın</th>
                <th aria-label="İşlemler" />
              </tr>
            </thead>
            <tbody>
              {announcements.map((announcement) => (
                <tr key={announcement.id}>
                  <td>
                    <span className="cell-strong">{announcement.title}</span>
                    <span className="cell-sub announcement-preview">{announcement.content}</span>
                  </td>
                  <td>
                    <Link to={`/tours/${announcement.tour_id}`}>{announcement.tour_title}</Link>
                  </td>
                  <td>
                    <StatusBadge map={ANNOUNCEMENT_PRIORITY} value={announcement.priority} />
                  </td>
                  <td>
                    <StatusBadge map={ANNOUNCEMENT_STATUS} value={announcement.status} />
                  </td>
                  <td>{announcement.published_at ? formatDateTime(announcement.published_at) : "-"}</td>
                  <td className="cell-actions">
                    {can("announcements.update") && announcement.status === "DRAFT" && (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() =>
                          setConfirm({
                            title: "Duyuruyu yayınla",
                            message: `"${announcement.title}" yayınlanacak ve turun katılımcılarına görünür olacak.`,
                            label: "Yayınla",
                            tone: "primary",
                            run: () => apiClient.patch(`/announcements/${announcement.id}/publish`),
                            done: "Duyuru yayınlandı.",
                          })
                        }
                      >
                        Yayınla
                      </button>
                    )}
                    {can("announcements.update") && (
                      <button type="button" className="btn-link" onClick={() => setForm({ announcement })}>
                        Düzenle
                      </button>
                    )}
                    {can("announcements.delete") && (
                      <button
                        type="button"
                        className="btn-link danger"
                        onClick={() =>
                          setConfirm({
                            title: "Duyuruyu sil",
                            message: `"${announcement.title}" kalıcı olarak silinecek.`,
                            label: "Sil",
                            tone: "danger",
                            run: () => apiClient.delete(`/announcements/${announcement.id}`),
                            done: "Duyuru silindi.",
                          })
                        }
                      >
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

      <Pagination pagination={data?.pagination} onPageChange={list.setPage} unit="duyuru" />

      {form && (
        <AnnouncementFormModal
          announcement={form.announcement || null}
          onClose={() => setForm(null)}
          onSaved={() => {
            const created = !form.announcement;
            setForm(null);
            toast.success(created ? "Duyuru taslak olarak oluşturuldu." : "Duyuru güncellendi.");
            reload();
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          tone={confirm.tone}
          onConfirm={async () => {
            await confirm.run();
            toast.success(confirm.done);
            reload();
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

export default Announcements;
