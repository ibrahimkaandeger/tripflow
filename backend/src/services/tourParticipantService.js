const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireEnum, requirePositiveNumber, fail } = require("../utils/validate");

const STATUSES = ["REGISTERED", "CONFIRMED", "CANCELLED", "COMPLETED"];
const PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"];
const CURRENCIES = ["TRY", "EUR", "USD", "GBP"];

async function assertParticipantInCompany(participantId, companyId) {
  const result = await pool.query("SELECT id FROM participants WHERE id = $1 AND company_id = $2", [participantId, companyId]);
  if (result.rows.length === 0) {
    throw new AppError(400, "INVALID_REFERENCE", "Katılımcı bu şirkete ait değil.");
  }
}

async function listTourParticipants(tourId) {
  const result = await pool.query(
    `SELECT tp.id, tp.tour_id, tp.participant_id, p.first_name, p.last_name, p.email,
            tp.status, tp.room_number, tp.special_requirements, tp.notes,
            tp.sale_price, tp.sale_currency, tp.payment_status,
            tp.created_at, tp.updated_at
     FROM tour_participants tp
     JOIN participants p ON p.id = tp.participant_id
     WHERE tp.tour_id = $1
     ORDER BY tp.created_at DESC`,
    [tourId]
  );
  return result.rows;
}

async function addParticipantToTour(companyId, tourId, body) {
  const { participant_id, status, room_number, special_requirements, notes, sale_price, sale_currency, payment_status } = body;

  if (!participant_id) {
    fail("participant_id zorunludur.");
  }
  await assertParticipantInCompany(participant_id, companyId);
  requireEnum(status, STATUSES, "status");
  requireEnum(payment_status, PAYMENT_STATUSES, "payment_status");
  requireEnum(sale_currency, CURRENCIES, "sale_currency");
  requirePositiveNumber(sale_price, "sale_price");

  try {
    const result = await pool.query(
      `INSERT INTO tour_participants (tour_id, participant_id, status, room_number, special_requirements, notes, sale_price, sale_currency, payment_status)
       VALUES ($1, $2, COALESCE($3, 'REGISTERED'), $4, $5, $6, $7, $8, COALESCE($9, 'UNPAID'))
       RETURNING *`,
      [tourId, participant_id, status, room_number || null, special_requirements || null, notes || null, sale_price || null, sale_currency || null, payment_status]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu katılımcı zaten bu tura kayıtlı.");
  }
}

async function updateTourParticipant(tourId, participantId, body) {
  const { status, room_number, special_requirements, notes, sale_price, sale_currency, payment_status } = body;

  requireEnum(status, STATUSES, "status");
  requireEnum(payment_status, PAYMENT_STATUSES, "payment_status");
  requireEnum(sale_currency, CURRENCIES, "sale_currency");
  requirePositiveNumber(sale_price, "sale_price");

  const fields = [];
  const values = [];
  let i = 1;

  const map = { status, room_number, special_requirements, notes, sale_price, sale_currency, payment_status };
  for (const [field, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${field} = $${i}`);
      values.push(value);
      i++;
    }
  }

  if (fields.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(tourId, participantId);

  try {
    const result = await pool.query(
      `UPDATE tour_participants SET ${fields.join(", ")} WHERE tour_id = $${i} AND participant_id = $${i + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Bu katılımcı bu tura kayıtlı değil.");
    }

    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    mapDbError(error);
  }
}

async function removeParticipantFromTour(tourId, participantId) {
  const result = await pool.query(
    "DELETE FROM tour_participants WHERE tour_id = $1 AND participant_id = $2 RETURNING id",
    [tourId, participantId]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Bu katılımcı bu tura kayıtlı değil.");
  }
}

module.exports = { listTourParticipants, addParticipantToTour, updateTourParticipant, removeParticipantFromTour };
