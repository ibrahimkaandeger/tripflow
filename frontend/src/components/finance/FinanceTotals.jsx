import { formatMoney } from "../../utils/money";

// Per-currency totals from a finance summary. Currencies are shown side
// by side, never converted or added together.
function FinanceTotals({ totals, outstanding }) {
  if (totals.length === 0 && outstanding.length === 0) {
    return <p className="muted">Henüz tamamlanmış finansal işlem yok.</p>;
  }

  const currencies = [...new Set([...totals.map((t) => t.currency), ...outstanding.map((o) => o.currency)])].sort();

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Para birimi</th>
            <th className="num">Gelir</th>
            <th className="num">Gider</th>
            <th className="num">İade</th>
            <th className="num">Net</th>
            <th className="num">Bekleyen tahsilat</th>
            <th className="num">Bekleyen işlem</th>
          </tr>
        </thead>
        <tbody>
          {currencies.map((currency) => {
            const total = totals.find((t) => t.currency === currency);
            const owed = outstanding.find((o) => o.currency === currency);
            const net = total ? Number(total.net) : 0;
            return (
              <tr key={currency}>
                <td className="cell-strong">{currency}</td>
                <td className="num">{total ? formatMoney(total.income) : "-"}</td>
                <td className="num">{total ? formatMoney(total.expense) : "-"}</td>
                <td className="num">{total ? formatMoney(total.refund) : "-"}</td>
                <td className={`num cell-strong ${net < 0 ? "amount-negative" : ""}`}>{total ? formatMoney(total.net) : "-"}</td>
                <td className="num">{owed ? formatMoney(owed.amount) : "-"}</td>
                <td className="num">{total ? total.pending_count : 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default FinanceTotals;
