import { useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import StatusBadge from "./ui/StatusBadge";
import ConfirmDialog from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "./ui/States";
import RegistrationFormModal from "./forms/RegistrationFormModal";
import { PAYMENT_STATUS, REGISTRATION_STATUS } from "../utils/labels";
import { formatMoney } from "../utils/money";

// Customers registered on the tour (newest registration first, as the
// API orders them). Price and payment columns only appear when the API
// actually returned them -- it strips them for users without
// finance.read.
function TourParticipants({ tourId, capacity }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => apiClient.get(`/tours/${tourId}/participants`), `tour-participants-${tourId}`);
  const [form, setForm] = useState(null); // null | { registration }
  const [removing, setRemoving] = useState(null);

  const rows = data?.data || [];
  const activeCount = rows.filter((row) => row.status !== "CANCELLED").length;
  const showFinance = rows.some((row) => "sale_price" in row);
  const canManage = can("participants.update");

  return (
    <section className="card">
      <div className="section-head">
        <h2>
          Katılımcılar{" "}
          {!loading && !error && (
            <span className="muted small">
              {activeCount}
              {capacity ? ` / ${capacity}` : ""} kişi
            </span>
          )}
        </h2>
        {canManage && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setForm({})}>
            + Müşteri Ekle
          </button>
        )}
      </div>

      {capacity && activeCount > capacity && (
        <p className="form-error">Kapasite aşıldı: {activeCount} aktif kayıt, kapasite {capacity}.</p>
      )}

      {loading && !data ? (
        <LoadingState label="Katılımcılar yükleniyor..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState title="Bu tur için henüz katılımcı bulunmuyor." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Müşteri</th>
                <th>Kayıt</th>
                <th>Oda</th>
                {showFinance && <th className="num">Fiyat</th>}
                {showFinance && <th>Ödeme</th>}
                {canManage && <th aria-label="İşlemler" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.participant_id}>
                  <td>
                    <Link to={`/customers/${row.participant_id}`} className="cell-strong">
                      {row.first_name} {row.last_name}
                    </Link>
                    {row.email && <span className="cell-sub">{row.email}</span>}
                    {row.special_requirements && <span className="cell-sub">Özel istek: {row.special_requirements}</span>}
                  </td>
                  <td>
                    <StatusBadge map={REGISTRATION_STATUS} value={row.status} />
                  </td>
                  <td>{row.room_number || "-"}</td>
                  {showFinance && <td className="num">{formatMoney(row.sale_price, row.sale_currency)}</td>}
                  {showFinance && (
                    <td>
                      <StatusBadge map={PAYMENT_STATUS} value={row.payment_status} />
                    </td>
                  )}
                  {canManage && (
                    <td className="cell-actions">
                      <button type="button" className="btn-link" onClick={() => setForm({ registration: row })}>
                        Düzenle
                      </button>
                      <button type="button" className="btn-link danger" onClick={() => setRemoving(row)}>
                        Çıkar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <RegistrationFormModal
          tourId={tourId}
          registration={form.registration || null}
          registeredIds={rows.map((row) => row.participant_id)}
          onClose={() => setForm(null)}
          onSaved={() => {
            const created = !form.registration;
            setForm(null);
            toast.success(created ? "Müşteri tura eklendi." : "Kayıt güncellendi.");
            reload();
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Müşteriyi turdan çıkar"
          message={`${removing.first_name} ${removing.last_name} bu turdan çıkarılacak. Müşteri kaydı silinmez. İptal durumuna almak geçmişi korur.`}
          confirmLabel="Turdan Çıkar"
          onConfirm={async () => {
            await apiClient.delete(`/tours/${tourId}/participants/${removing.participant_id}`);
            toast.success("Müşteri turdan çıkarıldı.");
            reload();
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  );
}

export default TourParticipants;
