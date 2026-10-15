import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import StatusBadge from "../components/ui/StatusBadge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import CustomerFormModal from "../components/forms/CustomerFormModal";
import { CUSTOMER_STATUS, PAYMENT_STATUS, REGISTRATION_STATUS } from "../utils/labels";
import { formatDate } from "../utils/date";
import { formatMoney } from "../utils/money";
import { isValidId } from "../utils/ids";

function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const validId = isValidId(id);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const customer = useApi(() => apiClient.get(`/participants/${id}`), validId ? `customer-${id}` : null, {
    notFound: "Müşteri bulunamadı.",
  });
  const tours = useApi(() => apiClient.get(`/participants/${id}/tours`), validId ? `customer-tours-${id}` : null);

  if (!validId) {
    return (
      <div className="page">
        <Link to="/customers">← Müşterilere Dön</Link>
        <ErrorState message="Müşteri bulunamadı." />
      </div>
    );
  }

  const record = customer.data?.data;
  const registrations = tours.data?.data || [];
  const showFinance = registrations.some((row) => "sale_price" in row);

  return (
    <div className="page">
      <Link to="/customers" className="back-link">
        ← Müşterilere Dön
      </Link>

      {customer.loading && !record ? (
        <LoadingState label="Müşteri yükleniyor..." />
      ) : customer.error ? (
        <ErrorState message={customer.error} onRetry={customer.reload} />
      ) : record ? (
        <>
          <header className="page-header">
            <div>
              <h1>
                {record.first_name} {record.last_name}
              </h1>
              <p className="page-subtitle">
                <StatusBadge map={CUSTOMER_STATUS} value={record.status} />
              </p>
            </div>
            <div className="page-actions">
              {can("participants.update") && (
                <button type="button" className="btn" onClick={() => setEditing(true)}>
                  Düzenle
                </button>
              )}
              {can("participants.delete") && (
                <button type="button" className="btn btn-danger" onClick={() => setDeleting(true)}>
                  Sil
                </button>
              )}
            </div>
          </header>

          <section className="card">
            <h2>Bilgiler</h2>
            <dl className="detail-grid">
              <div>
                <dt>E-posta</dt>
                <dd>{record.email || "-"}</dd>
              </div>
              <div>
                <dt>Telefon</dt>
                <dd>{record.phone || "-"}</dd>
              </div>
              <div>
                <dt>Şehir</dt>
                <dd>{record.city || "-"}</dd>
              </div>
              <div>
                <dt>Doğum tarihi</dt>
                <dd>{formatDate(record.birth_date)}</dd>
              </div>
              <div>
                <dt>Pasaport no</dt>
                <dd>{record.passport_number || "-"}</dd>
              </div>
              <div>
                <dt>Pasaport ülkesi</dt>
                <dd>{record.passport_country || "-"}</dd>
              </div>
            </dl>
            {record.notes && <p className="notes-block">{record.notes}</p>}
          </section>

          <section className="card">
            <h2>Turları</h2>
            {tours.loading && !tours.data ? (
              <LoadingState label="Turlar yükleniyor..." />
            ) : tours.error ? (
              <ErrorState message={tours.error} onRetry={tours.reload} />
            ) : registrations.length === 0 ? (
              <EmptyState title="Bu müşteri henüz bir tura kayıtlı değil." description="Tur sayfasından müşteri ekleyebilirsiniz." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tur</th>
                      <th>Tarihler</th>
                      <th>Kayıt</th>
                      {showFinance && <th className="num">Fiyat</th>}
                      {showFinance && <th>Ödeme</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((row) => (
                      <tr key={row.tour_id} className="row-link" onClick={() => navigate(`/tours/${row.tour_id}`)}>
                        <td className="cell-strong">
                          {row.title}
                          <span className="cell-sub">{row.destination}</span>
                        </td>
                        <td>
                          {formatDate(row.start_date)} – {formatDate(row.end_date)}
                        </td>
                        <td>
                          <StatusBadge map={REGISTRATION_STATUS} value={row.status} />
                        </td>
                        {showFinance && <td className="num">{formatMoney(row.sale_price, row.sale_currency)}</td>}
                        {showFinance && (
                          <td>
                            <StatusBadge map={PAYMENT_STATUS} value={row.payment_status} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {editing && record && (
        <CustomerFormModal
          customer={record}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success("Müşteri güncellendi.");
            customer.reload();
          }}
        />
      )}

      {deleting && record && (
        <ConfirmDialog
          title="Müşteriyi sil"
          message={`${record.first_name} ${record.last_name} kalıcı olarak silinecek. Finansal kaydı olan müşteriler silinemez; onları pasif yapın.`}
          onConfirm={async () => {
            await apiClient.delete(`/participants/${record.id}`);
            toast.success("Müşteri silindi.");
            navigate("/customers", { replace: true });
          }}
          onClose={() => setDeleting(false)}
        />
      )}
    </div>
  );
}

export default CustomerDetail;
