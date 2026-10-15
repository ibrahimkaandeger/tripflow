const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireField, requireEnum, requireDateTime, requireMaxLength, requireIntId, fail } = require("../utils/validate");
const { buildPaginationMeta } = require("../utils/pagination");
const { parseListQuery } = require("../utils/listQuery");

const STATUSES = ["SCHEDULED", "DELAYED", "CANCELLED", "COMPLETED"];
const PARTICIPANT_STATUSES = ["CONFIRMED", "CANCELLED"];

const UPDATABLE_FIELDS = [
  "airline", "flight_number", "departure_airport", "arrival_airport",
  "departure_datetime", "arrival_datetime", "departure_terminal", "arrival_terminal",
  "booking_reference", "status", "notes",
];

function validateFlightInput(body, { partial = false } = {}) {
  for (const field of ["airline", "flight_number", "departure_airport", "arrival_airport", "departure_datetime", "arrival_datetime"]) {
    if (!partial || body[field] !== undefined) requireField(body, field);
  }

  requireDateTime(body.departure_datetime, "departure_datetime");
  requireDateTime(body.arrival_datetime, "arrival_datetime");

  // VARCHAR limits from 008_flights.sql.
  const maxLengths = {
    airline: 150, flight_number: 20, departure_airport: 100, arrival_airport: 100,
    departure_terminal: 20, arrival_terminal: 20, booking_reference: 50,
  };
  for (const [field, max] of Object.entries(maxLengths)) requireMaxLength(body[field], max, field);

  if (body.departure_datetime && body.arrival_datetime && new Date(body.arrival_datetime) <= new Date(body.departure_datetime)) {
    fail("arrival_datetime, departure_datetime değerinden sonra olmalı.");
  }

  requireEnum(body.status, STATUSES, "status");
}

async function listFlightsForTour(tourId) {
  const result = await pool.query("SELECT * FROM flights WHERE tour_id = $1 ORDER BY departure_datetime", [tourId]);
  return result.rows;
}

// Every flight of the company across all tours, newest departure first,
// with the tour title for display. Optional filters: tour, status,
// search (airline / flight number / airports).
async function listFlights(companyId, query) {
  const { page, limit, offset, tourId, status, search } = parseListQuery(query, { statuses: STATUSES });
  const conditions = ["t.company_id = $1"];
  const params = [companyId];

  if (tourId) { params.push(tourId); conditions.push(`f.tour_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`f.status = $${params.length}`); }
  if (search) {
    params.push(search);
    const p = `$${params.length}`;
    conditions.push(`(f.airline ILIKE ${p} OR f.flight_number ILIKE ${p} OR f.departure_airport ILIKE ${p} OR f.arrival_airport ILIKE ${p})`);
  }

  const where = conditions.join(" AND ");
  const count = await pool.query(`SELECT COUNT(*) FROM flights f JOIN tours t ON t.id = f.tour_id WHERE ${where}`, params);
  const result = await pool.query(
    `SELECT f.*, t.title AS tour_title
     FROM flights f JOIN tours t ON t.id = f.tour_id
     WHERE ${where}
     ORDER BY f.departure_datetime DESC, f.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { data: result.rows, pagination: buildPaginationMeta(page, limit, Number(count.rows[0].count)) };
}

async function getFlightById(id) {
  const result = await pool.query("SELECT * FROM flights WHERE id = $1", [id]);
  if (result.rows.length === 0) {
    throw new AppError(404, "FLIGHT_NOT_FOUND", "Uçuş bulunamadı.");
  }
  return result.rows[0];
}

async function createFlight(tourId, body) {
  validateFlightInput(body);

  try {
    const result = await pool.query(
      `INSERT INTO flights (tour_id, airline, flight_number, departure_airport, arrival_airport,
                             departure_datetime, arrival_datetime, departure_terminal, arrival_terminal,
                             booking_reference, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'SCHEDULED'), $12)
       RETURNING *`,
      [tourId, body.airline, body.flight_number, body.departure_airport, body.arrival_airport,
       body.departure_datetime, body.arrival_datetime, body.departure_terminal || null, body.arrival_terminal || null,
       body.booking_reference || null, body.status, body.notes || null]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function updateFlight(id, body) {
  await getFlightById(id);
  validateFlightInput(body, { partial: true });

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
  values.push(id);

  try {
    const result = await pool.query(`UPDATE flights SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function deleteFlight(id) {
  await getFlightById(id);
  await pool.query("DELETE FROM flights WHERE id = $1", [id]);
}

async function addFlightParticipant(flightId, body) {
  const { participant_id, seat_number, ticket_number, status } = body;
  if (!participant_id) fail("participant_id zorunludur.");
  requireIntId(participant_id, "participant_id");
  requireEnum(status, PARTICIPANT_STATUSES, "status");

  try {
    const result = await pool.query(
      `INSERT INTO flight_participants (flight_id, participant_id, seat_number, ticket_number, status)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'CONFIRMED')) RETURNING *`,
      [flightId, participant_id, seat_number || null, ticket_number || null, status]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu katılımcı zaten bu uçuşa atanmış.");
  }
}

async function updateFlightParticipant(flightId, participantId, body) {
  const { seat_number, ticket_number, status } = body;
  requireEnum(status, PARTICIPANT_STATUSES, "status");

  const fields = [];
  const values = [];
  let i = 1;
  const map = { seat_number, ticket_number, status };
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

  values.push(flightId, participantId);

  try {
    const result = await pool.query(
      `UPDATE flight_participants SET ${fields.join(", ")} WHERE flight_id = $${i} AND participant_id = $${i + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Bu katılımcı bu uçuşa atanmamış.");
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    mapDbError(error);
  }
}

async function removeFlightParticipant(flightId, participantId) {
  const result = await pool.query(
    "DELETE FROM flight_participants WHERE flight_id = $1 AND participant_id = $2 RETURNING id",
    [flightId, participantId]
  );
  if (result.rows.length === 0) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Bu katılımcı bu uçuşa atanmamış.");
  }
}

module.exports = {
  listFlightsForTour, listFlights, getFlightById, createFlight, updateFlight, deleteFlight,
  addFlightParticipant, updateFlightParticipant, removeFlightParticipant,
};
