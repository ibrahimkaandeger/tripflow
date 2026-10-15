const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const {
  requireField,
  requireEnum,
  requirePositiveNumber,
  requireIntId,
  requireDateOnly,
} = require("../utils/validate");
const {
  parsePagination,
  buildPaginationMeta,
} = require("../utils/pagination");
const { requireMaxLength } = require("../utils/validate");
const { syncPaymentStatus } = require("./financeSummaryService");

const TYPES = ["INCOME", "EXPENSE", "REFUND"];

const CATEGORIES = [
  "PARTICIPANT_PAYMENT",
  "TOUR_SALE",
  "HOTEL",
  "FLIGHT",
  "TRANSPORT",
  "FOOD",
  "GUIDE",
  "ACTIVITY",
  "INSURANCE",
  "VISA",
  "PARTICIPANT_REFUND",
  "OTHER",
];

const STATUSES = ["PENDING", "COMPLETED", "CANCELLED"];
const UPDATE_STATUSES = ["PENDING", "COMPLETED"];
const CURRENCIES = ["TRY", "EUR", "USD", "GBP"];

function validateInput(body, { partial = false } = {}) {
  for (const field of [
    "type",
    "category",
    "amount",
    "currency",
    "transaction_date",
  ]) {
    if (!partial || body[field] !== undefined) {
      requireField(body, field);
    }
  }

  // type/currency are only meaningful to validate as enums on create.
  // On a partial (update) call their presence at all is rejected
  // explicitly below (updateTransaction), not silently accepted here
  // and then silently dropped for not being in UPDATABLE_FIELDS.
  if (!partial) {
    requireEnum(body.type, TYPES, "type");
    requireEnum(body.currency, CURRENCIES, "currency");
  }
  requireEnum(body.category, CATEGORIES, "category");
  requireEnum(body.status, STATUSES, "status");
  requirePositiveNumber(body.amount, "amount");
  // DATE column: exactly YYYY-MM-DD (an impossible day like
  // 2026-02-30 would otherwise reach Postgres and fail with a 500).
  requireDateOnly(body.transaction_date, "transaction_date");
  requireMaxLength(body.reference_number, 50, "reference_number");

  // participant_id is optional on create; when given it must be a real
  // integer id, otherwise Postgres rejects it with a 500.
  if (!partial && body.participant_id !== undefined && body.participant_id !== null && body.participant_id !== "") {
    requireIntId(body.participant_id, "participant_id");
  }
}

// Every list filter is checked before it reaches SQL so bad input is a
// clean 400 instead of a Postgres cast error (500). Enum filters reuse
// the same constants the write path validates against.
function validateListQuery(query) {
  for (const key of ["tour", "participant", "page", "limit"]) {
    if (query[key] !== undefined && query[key] !== "") {
      requireIntId(query[key], key);
    }
  }

  requireEnum(query.type || undefined, TYPES, "type");
  requireEnum(query.category || undefined, CATEGORIES, "category");
  requireEnum(query.status || undefined, STATUSES, "status");
  requireEnum(query.currency || undefined, CURRENCIES, "currency");

  requireDateOnly(query.dateFrom || undefined, "dateFrom");
  requireDateOnly(query.dateTo || undefined, "dateTo");
}

async function listTransactions(companyId, query) {
  validateListQuery(query);
  const { page, limit, offset } = parsePagination(query);

  const conditions = ["company_id = $1"];
  const params = [companyId];

  const filterMap = {
    tour: "tour_id",
    participant: "participant_id",
    type: "type",
    category: "category",
    status: "status",
    currency: "currency",
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

  const countResult = await pool.query(
    `SELECT COUNT(*)
     FROM finance_transactions
     WHERE ${where}`,
    params
  );

  const result = await pool.query(
    `SELECT *
     FROM finance_transactions
     WHERE ${where}
     ORDER BY transaction_date DESC, id DESC
     LIMIT $${params.length + 1}
     OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    data: result.rows,
    pagination: buildPaginationMeta(
      page,
      limit,
      Number(countResult.rows[0].count)
    ),
  };
}

async function listTransactionsForTour(companyId, tourId, query) {
  return listTransactions(companyId, {
    ...query,
    tour: tourId,
  });
}

async function getTransactionById(id) {
  const result = await pool.query(
    "SELECT * FROM finance_transactions WHERE id = $1",
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError(
      404,
      "TRANSACTION_NOT_FOUND",
      "Finansal kayıt bulunamadı."
    );
  }

  return result.rows[0];
}

async function createTransaction(companyId, tourId, userId, body) {
  validateInput(body);

  try {
    const result = await pool.query(
      `INSERT INTO finance_transactions (
         company_id,
         tour_id,
         participant_id,
         type,
         category,
         amount,
         currency,
         status,
         transaction_date,
         description,
         reference_number,
         created_by
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         COALESCE($8, 'PENDING'),
         $9,
         $10,
         $11,
         $12
       )
       RETURNING *`,
      [
        companyId,
        tourId,
        body.participant_id || null,
        body.type,
        body.category,
        body.amount,
        body.currency,
        body.status,
        body.transaction_date,
        body.description || null,
        body.reference_number || null,
        userId,
      ]
    );

    const transaction = result.rows[0];
    await syncPaymentStatus(transaction.tour_id, transaction.participant_id);
    return transaction;
  } catch (error) {
    mapDbError(
      error,
      "Bu referans numarası bu şirkette zaten kullanılıyor."
    );
  }
}

// Finansal kayıtta currency değiştirilmez.
// CANCELLED durumu normal update üzerinden verilemez.
// İptal işlemi yalnızca cancelTransaction() üzerinden yapılır.
const UPDATABLE_FIELDS = [
  "category",
  "amount",
  "status",
  "transaction_date",
  "description",
  "reference_number",
];

async function updateTransaction(id, body) {
  await getTransactionById(id);

  validateInput(body, { partial: true });

  // type ve currency oluşturulduktan sonra değiştirilemez. Sessizce
  // yok sayılıp 200 dönmek yerine -- ki bu client'a "değişti"
  // izlenimi verir -- istek bütünüyle reddedilir, böylece aynı
  // PATCH'teki başka alanlar (örn. category) da uygulanmaz. Bu throw
  // her zaman tek SQL çağrısından (aşağıdaki UPDATE) önce gerçekleşir,
  // dolayısıyla DB'ye kısmi bir yazım da olmaz.
  if (body.type !== undefined) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "type alanı oluşturulduktan sonra değiştirilemez."
    );
  }

  if (body.currency !== undefined) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "currency alanı oluşturulduktan sonra değiştirilemez."
    );
  }

  if (
    body.status !== undefined &&
    !UPDATE_STATUSES.includes(body.status)
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Güncelleme sırasında status yalnızca PENDING veya COMPLETED olabilir. İptal işlemi /cancel endpoint'i üzerinden yapılmalıdır."
    );
  }

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

  if (fields.length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Güncellenecek en az bir alan gerekli."
    );
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE finance_transactions
       SET ${fields.join(", ")}
       WHERE id = $${i}
       RETURNING *`,
      values
    );

    const transaction = result.rows[0];
    await syncPaymentStatus(transaction.tour_id, transaction.participant_id);
    return transaction;
  } catch (error) {
    mapDbError(
      error,
      "Bu referans numarası bu şirkette zaten kullanılıyor."
    );
  }
}

// Finansal kayıtlar silinmez.
// İptal işlemi audit trail korunması için CANCELLED olarak işaretlenir.
async function cancelTransaction(id) {
  await getTransactionById(id);

  const result = await pool.query(
    `UPDATE finance_transactions
     SET status = 'CANCELLED',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  const transaction = result.rows[0];
  await syncPaymentStatus(transaction.tour_id, transaction.participant_id);
  return transaction;
}

module.exports = {
  listTransactions,
  listTransactionsForTour,
  getTransactionById,
  createTransaction,
  updateTransaction,
  cancelTransaction,
};