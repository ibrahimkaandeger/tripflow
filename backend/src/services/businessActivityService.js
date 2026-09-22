const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireField, fail } = require("../utils/validate");

// Only real columns (no activity_type/status -- those were never
// added to this table by any migration; inventing them here would
// violate "do not invent new database fields").
const UPDATABLE_FIELDS = ["title", "description", "location", "start_time", "end_time"];

function validateActivityInput(body, { partial = false } = {}) {
  if (!partial || body.title !== undefined) requireField(body, "title");

  if (body.start_time && body.end_time && body.start_time > body.end_time) {
    fail("start_time, end_time değerinden sonra olamaz.");
  }
}

async function listActivitiesForTourDay(tourDayId) {
  const result = await pool.query(
    "SELECT * FROM activities WHERE tour_day_id = $1 ORDER BY start_time ASC NULLS LAST",
    [tourDayId]
  );
  return result.rows;
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

module.exports = { listActivitiesForTourDay, getActivityById, createActivity, updateActivity, deleteActivity };
