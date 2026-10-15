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
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import CustomerFormModal from "../components/forms/CustomerFormModal";
import { CUSTOMER_STATUS } from "../utils/labels";
import { formatDate } from "../utils/date";

const PAGE_SIZE = 20;

function Customers() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null | "new" | customer
  const [deleting, setDeleting] = useState(null);

  const debouncedSearch = useDebouncedValue(search.trim());
  const params = { page, limit: PAGE_SIZE, search: debouncedSearch || undefined, status: status || undefined };
  const { data, loading, error, reload } = useApi(
    () => apiClient.get("/participants", { params }),
    JSON.stringify(params)
  );
  const customers = data?.data || [];
  const filtered = Boolean(debouncedSearch || status);

  function changeFilter(setter) {
    return (event) => {
      setter(event.target.value);
      setPage(1);
    };
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Müşteriler</h1>
          <p className="page-subtitle">Turlarınıza katılan müşterileri yönetin.</p>
        </div>
        {can("participants.create") && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
              + Yeni Müşteri
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
              placeholder="Ad, e-posta veya telefon"
              value={search}
              onChange={changeFilter(setSearch)}
            />
          )}
        </Field>
        <Field label="Durum">
          {(id) => (
            <select id={id} className="select" value={status} onChange={changeFilter(setStatus)}>
              <option value="">Tümü</option>
              {Object.entries(CUSTOMER_STATUS).map(([value, { label }]) => (
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
          <LoadingState label="Müşteriler yükleniyor..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : customers.length === 0 ? (
          <EmptyState
            title={filtered ? "Eşleşen müşteri bulunamadı." : "Henüz müşteri yok."}
            description={filtered ? "Arama veya filtreyi değiştirin." : "İlk müşterinizi ekleyerek başlayın."}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>İletişim</th>
                <th>Şehir</th>
                <th>Durum</th>
                <th>Eklenme</th>
                <th aria-label="İşlemler" />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="row-link" onClick={() => navigate(`/customers/${customer.id}`)}>
                  <td className="cell-strong">
                    {customer.first_name} {customer.last_name}
                  </td>
                  <td>
                    {customer.email || "-"}
                    {customer.phone && <span className="cell-sub">{customer.phone}</span>}
                  </td>
                  <td>{customer.city || "-"}</td>
                  <td>
                    <StatusBadge map={CUSTOMER_STATUS} value={customer.status} />
                  </td>
                  <td>{formatDate(customer.created_at)}</td>
                  <td className="cell-actions" onClick={(event) => event.stopPropagation()}>
                    {can("participants.update") && (
                      <button type="button" className="btn-link" onClick={() => setEditing(customer)}>
                        Düzenle
                      </button>
                    )}
                    {can("participants.delete") && (
                      <button type="button" className="btn-link danger" onClick={() => setDeleting(customer)}>
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

      <Pagination pagination={data?.pagination} onPageChange={setPage} unit="müşteri" />

      {editing && (
        <CustomerFormModal
          customer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            const created = editing === "new";
            setEditing(null);
            toast.success(created ? "Müşteri eklendi." : "Müşteri güncellendi.");
            if (created) navigate(`/customers/${saved.id}`);
            else reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Müşteriyi sil"
          message={`${deleting.first_name} ${deleting.last_name} kalıcı olarak silinecek. Tur kayıtları da kaldırılır. Finansal kaydı olan müşteriler silinemez; onları pasif yapın.`}
          onConfirm={async () => {
            await apiClient.delete(`/participants/${deleting.id}`);
            toast.success("Müşteri silindi.");
            reload();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

export default Customers;
