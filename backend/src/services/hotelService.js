const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireField, requireEnum, requirePositiveNumber, requireValidDate, fail } = require("../utils/validate");

const HOTEL_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];
const ROOM_STATUSES = ["ACTIVE", "CANCELLED"];
const ROOM_PARTICIPANT_STATUSES = ["CONFIRMED", "CANCELLED"];

const HOTEL_FIELDS = ["hotel_name", "address", "city", "country", "check_in", "check_out", "booking_reference", "status", "notes"];
const ROOM_FIELDS = ["room_number", "room_type", "capacity", "status", "notes"];
const ROOM_PARTICIPANT_FIELDS = ["check_in", "check_out", "status", "notes"];

// check_hotel_room_capacity and check_hotel_room_participant_in_tour
// (both in database/migrations/009_hotels.sql) are separate BEFORE
// INSERT/UPDATE triggers on hotel_room_participants, but neither
// RAISE EXCEPTION specifies a SQLSTATE, so Postgres defaults both to
// P0001 -- dbErrors.js's generic P0001 handling (SCOPE_VIOLATION)
// can't tell them apart by code alone. The two triggers' messages are
// fixed, distinct formats, so the capacity one is matched by message
// text here rather than changing what P0001 means for every other
// trigger in the app (documents/finance/announcements/flights all
// raise their own tenant-scope P0001s and must keep getting the
// generic SCOPE_VIOLATION response).
const ROOM_CAPACITY_ERROR_PATTERN = /^hotel_room_participants: room \d+ capacity \d+ exceeded/;

function isRoomCapacityExceededError(error) {
  return error.code === "P0001" && ROOM_CAPACITY_ERROR_PATTERN.test(error.message || "");
}

function validateHotelInput(body, { partial = false } = {}) {
  if (!partial || body.hotel_name !== undefined) requireField(body, "hotel_name");
  if (!partial || body.check_in !== undefined) requireField(body, "check_in");
  if (!partial || body.check_out !== undefined) requireField(body, "check_out");

  requireValidDate(body.check_in, "check_in");
  requireValidDate(body.check_out, "check_out");

  if (body.check_in && body.check_out && new Date(body.check_out) < new Date(body.check_in)) {
    fail("check_out, check_in tarihinden önce olamaz.");
  }

  requireEnum(body.status, HOTEL_STATUSES, "status");
}

// ---------------- Hotels ----------------

async function listHotelsForTour(tourId) {
  const result = await pool.query("SELECT * FROM hotels WHERE tour_id = $1 ORDER BY check_in", [tourId]);
  return result.rows;
}

async function getHotelById(id) {
  const result = await pool.query("SELECT * FROM hotels WHERE id = $1", [id]);
  if (result.rows.length === 0) throw new AppError(404, "HOTEL_NOT_FOUND", "Otel bulunamadı.");
  return result.rows[0];
}

async function createHotel(tourId, body) {
  validateHotelInput(body);
  try {
    const result = await pool.query(
      `INSERT INTO hotels (tour_id, hotel_name, address, city, country, check_in, check_out, booking_reference, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'PENDING'), $10) RETURNING *`,
      [tourId, body.hotel_name, body.address || null, body.city || null, body.country || null,
       body.check_in, body.check_out, body.booking_reference || null, body.status, body.notes || null]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function updateHotel(id, body) {
  await getHotelById(id);
  validateHotelInput(body, { partial: true });

  const { fields, values, i } = buildUpdate(HOTEL_FIELDS, body);
  if (fields.length === 0) throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  try {
    const result = await pool.query(`UPDATE hotels SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function deleteHotel(id) {
  await getHotelById(id);
  await pool.query("DELETE FROM hotels WHERE id = $1", [id]);
}

// ---------------- Hotel Rooms ----------------

async function listRoomsForHotel(hotelId) {
  const result = await pool.query("SELECT * FROM hotel_rooms WHERE hotel_id = $1 ORDER BY room_number", [hotelId]);
  return result.rows;
}

async function getRoomById(id) {
  const result = await pool.query("SELECT * FROM hotel_rooms WHERE id = $1", [id]);
  if (result.rows.length === 0) throw new AppError(404, "ROOM_NOT_FOUND", "Oda bulunamadı.");
  return result.rows[0];
}

async function createRoom(hotelId, body) {
  requireField(body, "room_number");
  requireEnum(body.status, ROOM_STATUSES, "status");
  requirePositiveNumber(body.capacity, "capacity");

  try {
    const result = await pool.query(
      `INSERT INTO hotel_rooms (hotel_id, room_number, room_type, capacity, status, notes)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'ACTIVE'), $6) RETURNING *`,
      [hotelId, body.room_number, body.room_type || null, body.capacity || null, body.status, body.notes || null]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu otelde bu oda numarası zaten mevcut.");
  }
}

async function updateRoom(id, body) {
  await getRoomById(id);
  requireEnum(body.status, ROOM_STATUSES, "status");
  requirePositiveNumber(body.capacity, "capacity");

  const { fields, values, i } = buildUpdate(ROOM_FIELDS, body);
  if (fields.length === 0) throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  try {
    const result = await pool.query(`UPDATE hotel_rooms SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu otelde bu oda numarası zaten mevcut.");
  }
}

async function deleteRoom(id) {
  await getRoomById(id);
  await pool.query("DELETE FROM hotel_rooms WHERE id = $1", [id]);
}

// ---------------- Room Participants ----------------

async function addRoomParticipant(roomId, body) {
  const { participant_id, check_in, check_out, status } = body;
  if (!participant_id) fail("participant_id zorunludur.");
  requireEnum(status, ROOM_PARTICIPANT_STATUSES, "status");
  requireValidDate(check_in, "check_in");
  requireValidDate(check_out, "check_out");

  try {
    const result = await pool.query(
      `INSERT INTO hotel_room_participants (room_id, participant_id, check_in, check_out, status)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'CONFIRMED')) RETURNING *`,
      [roomId, participant_id, check_in || null, check_out || null, status]
    );
    return result.rows[0];
  } catch (error) {
    if (isRoomCapacityExceededError(error)) {
      throw new AppError(422, "ROOM_CAPACITY_EXCEEDED", "Oda kapasitesi aşıldı.");
    }
    mapDbError(error, "Bu katılımcı zaten bu odaya atanmış.");
  }
}

async function updateRoomParticipant(roomId, participantId, body) {
  requireEnum(body.status, ROOM_PARTICIPANT_STATUSES, "status");
  requireValidDate(body.check_in, "check_in");
  requireValidDate(body.check_out, "check_out");

  const { fields, values, i } = buildUpdate(ROOM_PARTICIPANT_FIELDS, body);
  if (fields.length === 0) throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  values.push(roomId, participantId);

  try {
    const result = await pool.query(
      `UPDATE hotel_room_participants SET ${fields.join(", ")} WHERE room_id = $${i} AND participant_id = $${i + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Bu katılımcı bu odaya atanmamış.");
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isRoomCapacityExceededError(error)) {
      throw new AppError(422, "ROOM_CAPACITY_EXCEEDED", "Oda kapasitesi aşıldı.");
    }
    mapDbError(error);
  }
}

async function removeRoomParticipant(roomId, participantId) {
  const result = await pool.query(
    "DELETE FROM hotel_room_participants WHERE room_id = $1 AND participant_id = $2 RETURNING id",
    [roomId, participantId]
  );
  if (result.rows.length === 0) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Bu katılımcı bu odaya atanmamış.");
}

function buildUpdate(allowedFields, body) {
  const fields = [];
  const values = [];
  let i = 1;
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${i}`);
      values.push(body[field]);
      i++;
    }
  }
  return { fields, values, i };
}

module.exports = {
  listHotelsForTour, getHotelById, createHotel, updateHotel, deleteHotel,
  listRoomsForHotel, getRoomById, createRoom, updateRoom, deleteRoom,
  addRoomParticipant, updateRoomParticipant, removeRoomParticipant,
};
