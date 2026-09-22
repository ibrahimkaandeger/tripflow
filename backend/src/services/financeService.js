const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireField, requireEnum, requirePositiveNumber, requireValidDate } = require("../utils/validate");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");

const TYPES = ["INCOME", "EXPENSE", "REFUND"];
const CATEGORIES = [
  "PARTICIPANT_PAYMENT", "TOUR_SALE", "HOTEL", "FLIGHT", "TRANSPORT", "FOOD",
  "GUIDE", "ACTIVITY", "INSURANCE", "VISA", "PARTICIPANT_REFUND", "OTHER",
];
const STATUSES = ["PENDING", "COMPLETED", "CANCELLED"];
const CURRENCIES = ["TRY", "EUR", "USD", "GBP"];

function validateInput(body, { partial = false } = {}) {
  for (const field of ["type", "category", "amount", "currency", "transaction_date"]) {
    if (!partial || body[field] !== undefined) requireField(body, field);
  }
  requireEnum(body.type, TYPES, "type");
  requireEnum(body.category, CATEGORIES, "category");
  requireEnum(body.status, STATUSES, "status");
  requireEnum(body.currency, CURRENCIES, "currency");
  requirePositiveNumber(body.amount, "amount");
  requireValidDate(body.transaction_date, "transaction_date");
}

async function listTransactions(companyId, query) {
  const { page, limit, offset } = parsePagination(query);
  const conditions = ["company_id = $1"];
  const params = [companyId];

  const filterMap = {
    tour: "tour_id", participant: "participant_id", type: "type",
    category: "category", status: "status", currency: "currency",
  };

  for (const [queryKey, column] of Object.entries(filterMap)) {
    if (query[queryKey]) {
      params.push(query[queryKey]);
      conditions.push(`${column} = $${params.length}`);
    }
  }
  if (query.dateFrom) {
    params.push(query.dateFrom);
    conditions.push(`transaction_date >= $${params.length}`);
  }
  if (query.dateTo) {
    params.push(query.dateTo);
    conditions.push(`transaction_date <= $${params.length}`);
  }

  const where = conditions.join(" AND ");
  const countResult = await pool.query(`SELECT COUNT(*) FROM finance_transactions WHERE ${where}`, params);
  const result = await pool.query(
    `SELECT * FROM finance_transactions WHERE ${where} ORDER BY transaction_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { data: result.rows, pagination: buildPaginationMeta(page, limit, Number(countResult.rows[0].count)) };
}

async function listTransactionsForTour(companyId, tourId, query) {
  return listTransactions(companyId, { ...query, tour: tourId });
}

async function getTransactionById(id) {
  const result = await pool.query("SELECT * FROM finance_transactions WHERE id = $1", [id]);
  if (result.rows.length === 0) throw new AppError(404, "TRANSACTION_NOT_FOUND", "Finansal kayıt bulunamadı.");
  return result.rows[0];
}

async function createTransaction(companyId, tourId, userId, body) {
  validateInput(body);

  try {
    const result = await pool.query(
      `INSERT INTO finance_transactions (company_id, tour_id, participant_id, type, category, amount, currency, status, transaction_date, description, reference_number, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'PENDING'), $9, $10, $11, $12)
       RETURNING *`,
      [companyId, tourId, body.participant_id || null, body.type, body.category, body.amount, body.currency,
       body.status, body.transaction_date, body.description || null, body.reference_number || null, userId]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu referans numarası bu şirkette zaten kullanılıyor.");
  }
}

// Only amount/category/description/reference_number/status/transaction_date
// are editable, and status here is a normal update (e.g. PENDING ->
// COMPLETED) -- final cancellation goes through cancelTransaction,
// not a free-form status write to CANCELLED via this path, to keep a
// single well-defined "how a transaction gets voided" story.
const UPDATABLE_FIELDS = ["category", "amount", "currency", "status", "transaction_date", "description", "reference_number"];

async function updateTransaction(id, body) {
  await getTransactionById(id);
  validateInput(body, { partial: true });

  const fields = [];
  const values = [];
  let i = 1;
  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${i}`);
      values.push(body[field]);
      i++;
    }
  }
  if (fields.length === 0) throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  try {
    const result = await pool.query(`UPDATE finance_transactions SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu referans numarası bu şirkette zaten kullanılıyor.");
  }
}

// The only supported way to void a transaction. No DELETE endpoint
// exists for finance_transactions at all (audit trail).
async function cancelTransaction(id) {
  await getTransactionById(id);
  const result = await pool.query(
    "UPDATE finance_transactions SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
}

module.exports = {
  listTransactions, listTransactionsForTour, getTransactionById,
  createTransaction, updateTransaction, cancelTransaction,
};
