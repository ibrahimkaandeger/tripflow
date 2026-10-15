const pool = require("../config/db");

// Read-side finance aggregation. Everything is derived from the real
// money movements in finance_transactions (only COMPLETED ones count)
// and the agreed price on tour_participants -- nothing is stored twice.
//
// Currencies are never converted or mixed: totals are grouped per
// currency, and a participant's balance is only computed from
// transactions in the participant's own sale_currency. Amounts are
// returned as decimal strings (like pg's NUMERIC), never floats.

// NUMERIC(12,2) strings -> integer cents, so the arithmetic below is
// exact.
function toCents(value) {
  if (value === null || value === undefined) return 0;
  return Math.round(Number(value) * 100);
}

function fromCents(cents) {
  return (cents / 100).toFixed(2);
}

// UNPAID / PARTIALLY_PAID / PAID / REFUNDED from price and net paid.
function derivePaymentStatus(saleCents, paidCents, refundedCents) {
  const net = paidCents - refundedCents;
  if (net >= saleCents) return "PAID";
  if (net > 0) return "PARTIALLY_PAID";
  if (refundedCents > 0 && paidCents > 0) return "REFUNDED";
  return "UNPAID";
}

const PARTICIPANT_BALANCE_SQL = `
  SELECT tp.tour_id, tp.participant_id, p.first_name, p.last_name,
         tp.status AS registration_status, tp.sale_price, tp.sale_currency, tp.payment_status,
         COALESCE(SUM(ft.amount) FILTER (
           WHERE ft.type = 'INCOME' AND ft.status = 'COMPLETED' AND ft.currency = tp.sale_currency), 0) AS paid,
         COALESCE(SUM(ft.amount) FILTER (
           WHERE ft.type = 'REFUND' AND ft.status = 'COMPLETED' AND ft.currency = tp.sale_currency), 0) AS refunded,
         COALESCE(BOOL_OR(
           ft.status = 'COMPLETED' AND ft.type IN ('INCOME', 'REFUND')
           AND ft.currency IS DISTINCT FROM tp.sale_currency), false) AS has_other_currency
  FROM tour_participants tp
  JOIN participants p ON p.id = tp.participant_id
  LEFT JOIN finance_transactions ft
    ON ft.tour_id = tp.tour_id AND ft.participant_id = tp.participant_id
`;

// Shapes one participant balance row. remaining/computed status are only
// meaningful when a price is set and no payment in a different currency
// muddies the balance.
function toBalance(row) {
  const saleCents = row.sale_price === null ? null : toCents(row.sale_price);
  const paidCents = toCents(row.paid);
  const refundedCents = toCents(row.refunded);
  const comparable = saleCents !== null && !row.has_other_currency;

  return {
    participant_id: row.participant_id,
    first_name: row.first_name,
    last_name: row.last_name,
    registration_status: row.registration_status,
    sale_price: row.sale_price,
    sale_currency: row.sale_currency,
    paid: fromCents(paidCents),
    refunded: fromCents(refundedCents),
    remaining: comparable ? fromCents(Math.max(saleCents - (paidCents - refundedCents), 0)) : null,
    payment_status: row.payment_status,
    has_other_currency: row.has_other_currency,
  };
}

async function totalsByCurrency(whereSql, params) {
  const result = await pool.query(
    `SELECT currency,
            COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME' AND status = 'COMPLETED'), 0) AS income,
            COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND status = 'COMPLETED'), 0) AS expense,
            COALESCE(SUM(amount) FILTER (WHERE type = 'REFUND' AND status = 'COMPLETED'), 0) AS refund,
            COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count
     FROM finance_transactions
     WHERE ${whereSql}
     GROUP BY currency
     ORDER BY currency`,
    params
  );

  return result.rows.map((row) => {
    const income = toCents(row.income);
    const expense = toCents(row.expense);
    const refund = toCents(row.refund);
    return {
      currency: row.currency,
      income: fromCents(income),
      expense: fromCents(expense),
      refund: fromCents(refund),
      // Net operational result: income - expense - refund.
      net: fromCents(income - expense - refund),
      pending_count: Number(row.pending_count),
    };
  });
}

// Sum of what is still owed, per sale currency, over the given balances
// (cancelled registrations owe nothing).
function outstandingByCurrency(balances) {
  const byCurrency = new Map();
  for (const balance of balances) {
    if (balance.registration_status === "CANCELLED" || balance.remaining === null) continue;
    const cents = toCents(balance.remaining);
    if (cents <= 0) continue;
    byCurrency.set(balance.sale_currency, (byCurrency.get(balance.sale_currency) || 0) + cents);
  }
  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, cents]) => ({ currency, amount: fromCents(cents) }));
}

async function getTourFinanceSummary(tourId) {
  const totals = await totalsByCurrency("tour_id = $1", [tourId]);

  const balances = await pool.query(
    `${PARTICIPANT_BALANCE_SQL}
     WHERE tp.tour_id = $1
     GROUP BY tp.tour_id, tp.participant_id, p.first_name, p.last_name, tp.status,
              tp.sale_price, tp.sale_currency, tp.payment_status
     ORDER BY p.last_name, p.first_name, tp.participant_id`,
    [tourId]
  );
  const participants = balances.rows.map(toBalance);

  return { totals, outstanding: outstandingByCurrency(participants), participants };
}

async function getCompanyFinanceSummary(companyId) {
  const totals = await totalsByCurrency("company_id = $1", [companyId]);

  const balances = await pool.query(
    `${PARTICIPANT_BALANCE_SQL}
     JOIN tours t ON t.id = tp.tour_id
     WHERE t.company_id = $1 AND t.status <> 'CANCELLED'
     GROUP BY tp.tour_id, tp.participant_id, p.first_name, p.last_name, tp.status,
              tp.sale_price, tp.sale_currency, tp.payment_status`,
    [companyId]
  );

  return { totals, outstanding: outstandingByCurrency(balances.rows.map(toBalance)) };
}

// Keeps tour_participants.payment_status in step with the recorded
// money: called after any transaction write that touches a
// participant. Left alone when there's no price to compare against or
// when payments were made in another currency (no conversion here).
async function syncPaymentStatus(tourId, participantId) {
  if (!tourId || !participantId) return;

  const result = await pool.query(
    `${PARTICIPANT_BALANCE_SQL}
     WHERE tp.tour_id = $1 AND tp.participant_id = $2
     GROUP BY tp.tour_id, tp.participant_id, p.first_name, p.last_name, tp.status,
              tp.sale_price, tp.sale_currency, tp.payment_status`,
    [tourId, participantId]
  );

  const row = result.rows[0];
  if (!row || row.sale_price === null || row.has_other_currency) return;

  const status = derivePaymentStatus(toCents(row.sale_price), toCents(row.paid), toCents(row.refunded));
  if (status !== row.payment_status) {
    await pool.query(
      "UPDATE tour_participants SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE tour_id = $2 AND participant_id = $3",
      [status, tourId, participantId]
    );
  }
}

module.exports = {
  getTourFinanceSummary,
  getCompanyFinanceSummary,
  syncPaymentStatus,
  derivePaymentStatus,
};
