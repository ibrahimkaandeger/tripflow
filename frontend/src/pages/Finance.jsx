import { useState } from "react";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import { useListFilters } from "../hooks/useListFilters";
import { useTourOptions } from "../hooks/useTourOptions";
import Field from "../components/ui/Field";
import Pagination from "../components/ui/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import TourSelect from "../components/forms/TourSelect";
import TransactionFormModal from "../components/forms/TransactionFormModal";
import FinanceTotals from "../components/finance/FinanceTotals";
import TransactionsTable from "../components/finance/TransactionsTable";
import { CURRENCIES, TRANSACTION_STATUS, TRANSACTION_TYPE } from "../utils/labels";

// Company-wide finance: per-currency totals and outstanding customer
// balances (computed by the API), and every transaction with filters.
function Finance() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useListFilters({ type: "", status: "", currency: "", dateFrom: "", dateTo: "" });
  const { tours } = useTourOptions();
  const [creating, setCreating] = useState(false);

  const summary = useApi(() => apiClient.get("/finance/summary"), "finance-summary");
  // The transactions endpoint has no free-text search; drop it.
  const params = { ...list.params };
  delete params.search;
  const transactions = useApi(() => apiClient.get("/finance/transactions", { params }), JSON.stringify(params));

  const tourTitles = Object.fromEntries(tours.map((tour) => [tour.id, tour.title]));
  const rows = transactions.data?.data || [];

  function reloadAll() {
    summary.reload();
    transactions.reload();
  }

  const select = (name, options, allLabel = "Tümü") => (id) => (
    <select id={id} className="select" value={list.filters[name]} onChange={(event) => list.setFilter(name, event.target.value)}>
      <option value="">{allLabel}</option>
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Finans</h1>
          <p className="page-subtitle">Tahsilatlar, giderler ve bekleyen ödemeler. Tutarlar para birimine göre ayrı gösterilir.</p>
        </div>
        {can("finance.create") && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              + Yeni İşlem
            </button>
          </div>
        )}
      </header>

      <section className="card">
        <h2>Genel Özet</h2>
        {summary.loading && !summary.data ? (
          <LoadingState label="Özet yükleniyor..." />
        ) : summary.error ? (
          <ErrorState message={summary.error} onRetry={summary.reload} />
        ) : summary.data ? (
          <FinanceTotals totals={summary.data.data.totals} outstanding={summary.data.data.outstanding} />
        ) : null}
      </section>

      <section className="card">
        <h2>İşlemler</h2>
        <div className="toolbar">
          <Field label="Tur">{(id) => <TourSelect id={id} value={list.tour} onChange={list.setTour} allowAll />}</Field>
          <Field label="Tür">{select("type", Object.entries(TRANSACTION_TYPE).map(([v, { label }]) => [v, label]))}</Field>
          <Field label="Durum">{select("status", Object.entries(TRANSACTION_STATUS).map(([v, { label }]) => [v, label]))}</Field>
          <Field label="Para birimi">{select("currency", CURRENCIES.map((c) => [c, c]))}</Field>
          <Field label="Başlangıç">
            {(id) => (
              <input id={id} className="input" type="date" value={list.filters.dateFrom} onChange={(event) => list.setFilter("dateFrom", event.target.value)} />
            )}
          </Field>
          <Field label="Bitiş">
            {(id) => (
              <input id={id} className="input" type="date" value={list.filters.dateTo} onChange={(event) => list.setFilter("dateTo", event.target.value)} />
            )}
          </Field>
        </div>

        {transactions.loading && !transactions.data ? (
          <LoadingState label="İşlemler yükleniyor..." />
        ) : transactions.error ? (
          <ErrorState message={transactions.error} onRetry={transactions.reload} />
        ) : rows.length === 0 ? (
          <EmptyState title={list.isFiltered ? "Filtrelere uyan işlem bulunamadı." : "Henüz finansal işlem yok."} />
        ) : (
          <>
            <TransactionsTable transactions={rows} tourTitles={tourTitles} onChanged={reloadAll} showTour />
            <Pagination pagination={transactions.data?.pagination} onPageChange={list.setPage} unit="işlem" />
          </>
        )}
      </section>

      {creating && (
        <TransactionFormModal
          transaction={null}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            toast.success("İşlem kaydedildi.");
            reloadAll();
          }}
        />
      )}
    </div>
  );
}

export default Finance;
