const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireField, requireTime, requireMaxLength, fail } = require("../utils/validate");
const { buildPaginationMeta } = require("../utils/pagination");
const { parseListQuery } = require("../utils/listQuery");

// Only real columns (no activity_type/status -- those were never
// added to this table by any migration; inventing them here would
// violate "do not invent new database fields").
const UPDATABLE_FIELDS = ["title", "description", "location", "start_time", "end_time"];

function validateActivityInput(body, { partial = false } = {}) {
  if (!partial || body.title !== undefined) requireField(body, "title");
  requireMaxLength(body.title, 200, "title");
  requireMaxLength(body.location, 255, "location");
  requireTime(body.start_time, "start_time");
  requireTime(body.end_time, "end_time");

  if (body.start_time && body.end_time && body.start_time > body.end_time) {
    fail("start_time, end_time değerinden sonra olamaz.");
  }
}

async function listActivitiesForTourDay(tourDayId) {
  const result = await pool.query(
    "SELECT * FROM activities WHERE tour_day_id = $1 ORDER BY start_time ASC NULLS LAST, id",
    [tourDayId]
  );
  return result.rows;
}

// Every activity of the company across all tours, in program order
// (tour start date, day number, start time), with the tour title and
// day info. Optional filters: tour, search (title / location).
async function listActivities(companyId, query) {
  const { page, limit, offset, tourId, search } = parseListQuery(query);
  const conditions = ["t.company_id = $1"];
  const params = [companyId];

  if (tourId) { params.push(tourId); conditions.push(`t.id = $${params.length}`); }
  if (search) {
    params.push(search);
    const p = `$${params.length}`;
    conditions.push(`(a.title ILIKE ${p} OR a.location ILIKE ${p})`);
  }

  const from = "activities a JOIN tour_days td ON td.id = a.tour_day_id JOIN tours t ON t.id = td.tour_id";
  const where = conditions.join(" AND ");
  const count = await pool.query(`SELECT COUNT(*) FROM ${from} WHERE ${where}`, params);
  const result = await pool.query(
    `SELECT a.*, td.tour_id, td.day_number, td.date AS day_date, t.title AS tour_title
     FROM ${from}
     WHERE ${where}
     ORDER BY t.start_date DESC, t.id DESC, td.day_number, a.start_time ASC NULLS LAST, a.id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { data: result.rows, pagination: buildPaginationMeta(page, limit, Number(count.rows[0].count)) };
}

async function getActivityById(id) {
  const result = await pool.query("SELECT * FROM activities WHERE id = $1", [id]);
  if (result.rows.length === 0) {
    throw new AppError(404, "ACTIVITY_NOT_FOUND", "Aktivite bulunamadı.");
  }
  return result.rows[0];
}

async function createActivity(tourDayId, body) {
  validateActivityInput(body);

  try {
    const result = await pool.query(
      `INSERT INTO activities (tour_day_id, title, description, location, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tourDayId, body.title, body.description || null, body.location || null, body.start_time || null, body.end_time || null]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function updateActivity(id, body) {
  await getActivityById(id);
  validateActivityInput(body, { partial: true });

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

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE activities SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function deleteActivity(id) {
  await getActivityById(id);
  await pool.query("DELETE FROM activities WHERE id = $1", [id]);
}

module.exports = { listActivitiesForTourDay, listActivities, getActivityById, createActivity, updateActivity, deleteActivity };
