import { useState } from "react";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import Pagination from "./ui/Pagination";
import StatusBadge from "./ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "./ui/States";
import FinanceTotals from "./finance/FinanceTotals";
import TransactionsTable from "./finance/TransactionsTable";
import TransactionFormModal from "./forms/TransactionFormModal";
import { PAYMENT_STATUS, REGISTRATION_STATUS } from "../utils/labels";
import { formatMoney } from "../utils/money";

const PAGE_SIZE = 20;

// The tour's money: per-currency totals and each customer's price /
// paid / remaining, all computed by the API from completed transactions,
// plus the paginated transaction list.
function TourFinance({ tourId }) {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const summary = useApi(() => apiClient.get(`/tours/${tourId}/finance/summary`), `tour-finance-summary-${tourId}`);
  const transactions = useApi(
    () => apiClient.get(`/tours/${tourId}/finance`, { params: { page, limit: PAGE_SIZE } }),
    `tour-finance-${tourId}-${page}`
  );

  function reloadAll() {
    summary.reload();
    transactions.reload();
  }

  const data = summary.data?.data;
  const rows = transactions.data?.data || [];

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>Finans Özeti</h2>
          {can("finance.create") && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
              + İşlem Ekle
            </button>
          )}
        </div>
        {summary.loading && !data ? (
          <LoadingState label="Özet yükleniyor..." />
        ) : summary.error ? (
          <ErrorState message={summary.error} onRetry={summary.reload} />
        ) : data ? (
          <FinanceTotals totals={data.totals} outstanding={data.outstanding} />
        ) : null}
      </section>

      <section className="card">
        <h2>Müşteri Ödemeleri</h2>
        {summary.loading && !data ? (
          <LoadingState />
        ) : summary.error ? null : !data || data.participants.length === 0 ? (
          <EmptyState title="Bu turda henüz kayıtlı müşteri yok." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Müşteri</th>
                  <th>Kayıt</th>
                  <th className="num">Fiyat</th>
                  <th className="num">Ödenen</th>
                  <th className="num">İade</th>
                  <th className="num">Kalan</th>
                  <th>Ödeme</th>
                </tr>
              </thead>
              <tbody>
                {data.participants.map((row) => (
                  <tr key={row.participant_id}>
                    <td className="cell-strong">
                      {row.first_name} {row.last_name}
                      {row.has_other_currency && <span className="cell-sub">Farklı para biriminde ödeme var; kalan hesaplanmadı.</span>}
                    </td>
                    <td>
                      <StatusBadge map={REGISTRATION_STATUS} value={row.registration_status} />
                    </td>
                    <td className="num">{formatMoney(row.sale_price, row.sale_currency)}</td>
                    <td className="num">{row.sale_currency ? formatMoney(row.paid, row.sale_currency) : "-"}</td>
                    <td className="num">{row.sale_currency && Number(row.refunded) > 0 ? formatMoney(row.refunded, row.sale_currency) : "-"}</td>
                    <td className="num cell-strong">{row.remaining !== null ? formatMoney(row.remaining, row.sale_currency) : "-"}</td>
                    <td>
                      <StatusBadge map={PAYMENT_STATUS} value={row.payment_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Finansal İşlemler</h2>
        {transactions.loading && !transactions.data ? (
          <LoadingState label="Finans işlemleri yükleniyor..." />
        ) : transactions.error ? (
          <ErrorState message={transactions.error} onRetry={transactions.reload} />
        ) : rows.length === 0 ? (
          <EmptyState title="Bu tur için henüz finansal işlem bulunmuyor." />
        ) : (
          <>
            <TransactionsTable transactions={rows} onChanged={reloadAll} />
            <Pagination pagination={transactions.data?.pagination} onPageChange={setPage} unit="işlem" />
          </>
        )}
      </section>

      {creating && (
        <TransactionFormModal
          transaction={null}
          tourId={tourId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            toast.success("İşlem kaydedildi.");
            reloadAll();
          }}
        />
      )}
    </>
  );
}

export default TourFinance;
