const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const {
  requireField, requireEnum, requireEmail, requireDateOnly, requireMaxLength, requireIntId, fail,
} = require("../utils/validate");

const STATUSES = ["ACTIVE", "INACTIVE", "CANCELLED"];
const UPDATABLE_FIELDS = [
  "first_name", "last_name", "email", "phone", "passport_number",
  "passport_country", "city", "birth_date", "notes", "status", "user_id",
];

// VARCHAR limits from 006_participants.sql.
const MAX_LENGTHS = {
  first_name: 100, last_name: 100, email: 255, phone: 50,
  passport_number: 50, passport_country: 100, city: 100,
};

function validateParticipantInput(body, { partial = false } = {}) {
  if (!partial || body.first_name !== undefined) requireField(body, "first_name");
  if (!partial || body.last_name !== undefined) requireField(body, "last_name");
  requireEnum(body.status, STATUSES, "status");

  for (const [field, max] of Object.entries(MAX_LENGTHS)) {
    requireMaxLength(body[field], max, field);
  }
  requireEmail(body.email, "email");
  if (body.birth_date) requireDateOnly(body.birth_date, "birth_date");
  if (body.user_id !== undefined && body.user_id !== null) requireIntId(body.user_id, "user_id");

  if (!partial && !body.email && !body.phone) {
    fail("email veya phone alanlarından en az biri zorunludur.");
  }
}

async function assertUserExists(userId) {
  if (userId === undefined || userId === null) return;
  const result = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
  if (result.rows.length === 0) {
    throw new AppError(400, "INVALID_REFERENCE", "Geçersiz user_id.");
  }
}

async function listParticipants(companyId, query) {
  const { page, limit, offset } = parsePagination(query);
  const conditions = ["company_id = $1"];
  const params = [companyId];

  if (query.status) {
    requireEnum(query.status, STATUSES, "status");
    params.push(query.status);
    conditions.push(`status = $${params.length}`);
  }
  if (query.search) {
    if (typeof query.search !== "string") fail("search tek bir metin olmalı.");
    params.push(`%${query.search.trim()}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(first_name ILIKE ${p} OR last_name ILIKE ${p} OR (first_name || ' ' || last_name) ILIKE ${p} OR email ILIKE ${p} OR phone ILIKE ${p})`
    );
  }

  const where = conditions.join(" AND ");
  const countResult = await pool.query(`SELECT COUNT(*) FROM participants WHERE ${where}`, params);

  const result = await pool.query(
    `SELECT id, company_id, user_id, first_name, last_name, email, phone, passport_country, city, birth_date, status, created_at, updated_at
     FROM participants WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { data: result.rows, pagination: buildPaginationMeta(page, limit, Number(countResult.rows[0].count)) };
}

async function getParticipantById(companyId, id) {
  const result = await pool.query("SELECT * FROM participants WHERE id = $1 AND company_id = $2", [id, companyId]);
  if (result.rows.length === 0) {
    throw new AppError(404, "PARTICIPANT_NOT_FOUND", "Katılımcı bulunamadı.");
  }
  return result.rows[0];
}

// Tours this participant is registered on, with the registration's own
// status/payment fields. Scoped by company on both sides.
async function listToursForParticipant(companyId, participantId) {
  const result = await pool.query(
    `SELECT t.id AS tour_id, t.title, t.destination, t.start_date, t.end_date, t.status AS tour_status,
            tp.status, tp.room_number, tp.sale_price, tp.sale_currency, tp.payment_status, tp.created_at
     FROM tour_participants tp
     JOIN tours t ON t.id = tp.tour_id
     JOIN participants p ON p.id = tp.participant_id
     WHERE tp.participant_id = $1 AND p.company_id = $2 AND t.company_id = $2
     ORDER BY t.start_date DESC, t.id DESC`,
    [participantId, companyId]
  );
  return result.rows;
}

async function createParticipant(companyId, body) {
  validateParticipantInput(body);
  await assertUserExists(body.user_id);

  try {
    const result = await pool.query(
      `INSERT INTO participants (company_id, user_id, first_name, last_name, email, phone, passport_number, passport_country, city, birth_date, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, 'ACTIVE'))
       RETURNING *`,
      [companyId, body.user_id || null, body.first_name, body.last_name, body.email || null, body.phone || null,
       body.passport_number || null, body.passport_country || null, body.city || null, body.birth_date || null,
       body.notes || null, body.status]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu kullanıcı zaten bu şirkette bir katılımcı.");
  }
}

async function updateParticipant(companyId, id, body) {
  await getParticipantById(companyId, id);
  validateParticipantInput(body, { partial: true });
  await assertUserExists(body.user_id);

  const fields = [];
  const values = [];
  let i = 1;

  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${i}`);
      // Clearing an optional field from a form sends "" -- store NULL.
      values.push(body[field] === "" ? null : body[field]);
      i++;
    }
  }

  if (fields.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id, companyId);

  try {
    const result = await pool.query(
      `UPDATE participants SET ${fields.join(", ")} WHERE id = $${i} AND company_id = $${i + 1} RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu kullanıcı zaten bu şirkette bir katılımcı.");
  }
}

// A participant with recorded money movements is not deleted: the
// finance FK would silently detach those transactions (SET NULL) and
// lose who paid. Such customers should be set INACTIVE instead.
async function deleteParticipant(companyId, id) {
  await getParticipantById(companyId, id);

  const finance = await pool.query(
    "SELECT 1 FROM finance_transactions WHERE participant_id = $1 LIMIT 1",
    [id]
  );
  if (finance.rows.length > 0) {
    throw new AppError(
      409,
      "PARTICIPANT_HAS_FINANCE",
      "Bu katılımcının finansal kayıtları olduğu için silinemez. Bunun yerine durumunu pasif yapın."
    );
  }

  await pool.query("DELETE FROM participants WHERE id = $1 AND company_id = $2", [id, companyId]);
}

module.exports = {
  listParticipants,
  getParticipantById,
  listToursForParticipant,
  createParticipant,
  updateParticipant,
  deleteParticipant,
};
