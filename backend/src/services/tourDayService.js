const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireField, requireValidDate, fail } = require("../utils/validate");

function validateDayInput(body, { partial = false } = {}) {
  if (!partial || body.day_number !== undefined) requireField(body, "day_number");
  if (!partial || body.date !== undefined) requireField(body, "date");

  if (body.day_number !== undefined && (!Number.isInteger(Number(body.day_number)) || Number(body.day_number) <= 0)) {
    fail("day_number pozitif bir tam sayı olmalı.");
  }
  requireValidDate(body.date, "date");
}

async function listTourDays(tourId) {
  const result = await pool.query("SELECT * FROM tour_days WHERE tour_id = $1 ORDER BY day_number", [tourId]);
  return result.rows;
}

async function getTourDayById(tourId, dayId) {
  const result = await pool.query("SELECT * FROM tour_days WHERE id = $1 AND tour_id = $2", [dayId, tourId]);
  if (result.rows.length === 0) {
    throw new AppError(404, "TOUR_DAY_NOT_FOUND", "Tur günü bulunamadı.");
  }
  return result.rows[0];
}

async function createTourDay(tourId, body) {
  validateDayInput(body);

  try {
    const result = await pool.query(
      `INSERT INTO tour_days (tour_id, day_number, date, title, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tourId, body.day_number, body.date, body.title || null, body.description || null]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu tur için bu gün numarası zaten mevcut.");
  }
}

async function updateTourDay(tourId, dayId, body) {
  await getTourDayById(tourId, dayId);
  validateDayInput(body, { partial: true });

  const allowed = ["day_number", "date", "title", "description"];
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
  values.push(dayId, tourId);

  try {
    const result = await pool.query(
      `UPDATE tour_days SET ${fields.join(", ")} WHERE id = $${i} AND tour_id = $${i + 1} RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu tur için bu gün numarası zaten mevcut.");
  }
}

async function deleteTourDay(tourId, dayId) {
  await getTourDayById(tourId, dayId);
  await pool.query("DELETE FROM tour_days WHERE id = $1 AND tour_id = $2", [dayId, tourId]);
}

module.exports = { listTourDays, getTourDayById, createTourDay, updateTourDay, deleteTourDay };
