import { useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../services/apiClient";
import { useAuth } from "../../context/authStore";
import { useToast } from "../../context/toastStore";
import StatusBadge from "../ui/StatusBadge";
import ConfirmDialog from "../ui/ConfirmDialog";
import TransactionFormModal from "../forms/TransactionFormModal";
import { CATEGORY_LABELS, TRANSACTION_STATUS, TRANSACTION_TYPE } from "../../utils/labels";
import { formatDate } from "../../utils/date";
import { formatMoney } from "../../utils/money";

// Transactions with their row actions (edit, complete, cancel).
// Financial records are never deleted -- cancelling keeps the audit
// trail. `showTour` adds a tour column for the company-wide list.
function TransactionsTable({ transactions, tourTitles, onChanged, showTour = false }) {
  const { can } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const canUpdate = can("finance.update");

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Tarih</th>
              {showTour && <th>Tur</th>}
              <th>Tür</th>
              <th>Kategori</th>
              <th className="num">Tutar</th>
              <th>Durum</th>
              <th>Açıklama</th>
              {canUpdate && <th aria-label="İşlemler" />}
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className={transaction.status === "CANCELLED" ? "row-muted" : ""}>
                <td>{formatDate(transaction.transaction_date)}</td>
                {showTour && (
                  <td>
                    <Link to={`/tours/${transaction.tour_id}?tab=finance`}>{tourTitles?.[transaction.tour_id] || `Tur #${transaction.tour_id}`}</Link>
                  </td>
                )}
                <td>
                  <StatusBadge map={TRANSACTION_TYPE} value={transaction.type} />
                </td>
                <td>{CATEGORY_LABELS[transaction.category] || transaction.category}</td>
                <td className="num cell-strong">{formatMoney(transaction.amount, transaction.currency)}</td>
                <td>
                  <StatusBadge map={TRANSACTION_STATUS} value={transaction.status} />
                </td>
                <td>
                  {transaction.description || "—"}
                  {transaction.reference_number && <span className="cell-sub">Ref: {transaction.reference_number}</span>}
                </td>
                {canUpdate && (
                  <td className="cell-actions">
                    {transaction.status !== "CANCELLED" && (
                      <>
                        {transaction.status === "PENDING" && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() =>
                              setConfirm({
                                title: "İşlemi tamamla",
                                message: `${formatMoney(transaction.amount, transaction.currency)} tutarlı işlem tamamlandı olarak işaretlenecek.`,
                                label: "Tamamla",
                                tone: "primary",
                                run: () => apiClient.patch(`/finance/transactions/${transaction.id}`, { status: "COMPLETED" }),
                                done: "İşlem tamamlandı.",
                              })
                            }
                          >
                            Tamamla
                          </button>
                        )}
                        <button type="button" className="btn-link" onClick={() => setEditing(transaction)}>
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="btn-link danger"
                          onClick={() =>
                            setConfirm({
                              title: "İşlemi iptal et",
                              message: "İşlem iptal edilecek. Kayıt silinmez; toplamlara ve ödeme durumuna artık dahil edilmez.",
                              label: "İptal Et",
                              tone: "danger",
                              run: () => apiClient.patch(`/finance/transactions/${transaction.id}/cancel`),
                              done: "İşlem iptal edildi.",
                            })
                          }
                        >
                          İptal
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <TransactionFormModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success("İşlem güncellendi.");
            onChanged();
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
            onChanged();
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

export default TransactionsTable;
