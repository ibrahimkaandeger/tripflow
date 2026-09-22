const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { requireField, requireEnum, fail } = require("../utils/validate");

const STATUSES = ["ACTIVE", "INACTIVE", "CANCELLED"];
const UPDATABLE_FIELDS = [
  "first_name", "last_name", "email", "phone", "passport_number",
  "passport_country", "city", "birth_date", "notes", "status", "user_id",
];

function validateParticipantInput(body, { partial = false } = {}) {
  if (!partial || body.first_name !== undefined) requireField(body, "first_name");
  if (!partial || body.last_name !== undefined) requireField(body, "last_name");
  requireEnum(body.status, STATUSES, "status");

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
    params.push(query.status);
    conditions.push(`status = $${params.length}`);
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    conditions.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  const where = conditions.join(" AND ");
  const countResult = await pool.query(`SELECT COUNT(*) FROM participants WHERE ${where}`, params);

  const result = await pool.query(
    `SELECT id, company_id, user_id, first_name, last_name, email, phone, passport_country, city, birth_date, status, created_at, updated_at
     FROM participants WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
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
      values.push(body[field]);
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

module.exports = { listParticipants, getParticipantById, createParticipant, updateParticipant };
