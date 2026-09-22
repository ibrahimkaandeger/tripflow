const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { requireField, requireEnum, requirePositiveNumber, requireValidDate, fail } = require("../utils/validate");

const STATUSES = ["DRAFT", "PLANNED", "CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"];

function validateTourInput(body, { partial = false } = {}) {
  if (!partial || body.title !== undefined) requireField(body, "title");
  if (!partial || body.destination !== undefined) requireField(body, "destination");
  if (!partial || body.start_date !== undefined) requireField(body, "start_date");
  if (!partial || body.end_date !== undefined) requireField(body, "end_date");

  requireValidDate(body.start_date, "start_date");
  requireValidDate(body.end_date, "end_date");

  if (body.start_date && body.end_date && new Date(body.start_date) > new Date(body.end_date)) {
    fail("start_date, end_date değerinden sonra olamaz.");
  }

  requireEnum(body.status, STATUSES, "status");
  requirePositiveNumber(body.capacity, "capacity");
}

async function listTours(companyId, query) {
  const { page, limit, offset } = parsePagination(query);
  const conditions = ["company_id = $1"];
  const params = [companyId];

  if (query.status) {
    params.push(query.status);
    conditions.push(`status = $${params.length}`);
  }
  if (query.destination) {
    params.push(`%${query.destination}%`);
    conditions.push(`destination ILIKE $${params.length}`);
  }
  if (query.startFrom) {
    params.push(query.startFrom);
    conditions.push(`start_date >= $${params.length}`);
  }
  if (query.startTo) {
    params.push(query.startTo);
    conditions.push(`start_date <= $${params.length}`);
  }

  const where = conditions.join(" AND ");

  const countResult = await pool.query(`SELECT COUNT(*) FROM tours WHERE ${where}`, params);

  const result = await pool.query(
    `SELECT * FROM tours WHERE ${where} ORDER BY start_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { data: result.rows, pagination: buildPaginationMeta(page, limit, Number(countResult.rows[0].count)) };
}

async function getTourById(companyId, id) {
  const result = await pool.query("SELECT * FROM tours WHERE id = $1 AND company_id = $2", [id, companyId]);
  if (result.rows.length === 0) {
    throw new AppError(404, "TOUR_NOT_FOUND", "Tur bulunamadı.");
  }
  return result.rows[0];
}

async function createTour(companyId, userId, body) {
  validateTourInput(body);

  try {
    const result = await pool.query(
      `INSERT INTO tours (company_id, title, description, destination, start_date, end_date, status, capacity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'DRAFT'), $8, $9)
       RETURNING *`,
      [companyId, body.title, body.description || null, body.destination, body.start_date, body.end_date, body.status, body.capacity || null, userId]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function updateTour(companyId, id, body) {
  await getTourById(companyId, id);
  validateTourInput(body, { partial: true });

  const allowed = ["title", "description", "destination", "start_date", "end_date", "status", "capacity"];
  const fields = [];
  const values = [];
  let i = 1;

  for (const field of allowed) {
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
      `UPDATE tours SET ${fields.join(", ")} WHERE id = $${i} AND company_id = $${i + 1} RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function deleteTour(companyId, id) {
  await getTourById(companyId, id);

  try {
    await pool.query("DELETE FROM tours WHERE id = $1 AND company_id = $2", [id, companyId]);
  } catch (error) {
    mapDbError(error, "Bu tur, ilişkili finansal kayıtlar nedeniyle silinemiyor.");
  }
}

module.exports = { listTours, getTourById, createTour, updateTour, deleteTour };
