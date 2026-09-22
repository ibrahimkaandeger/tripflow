const pool = require("../config/db");

// Read-only, participant-facing views. Every query here is scoped by
// participants.user_id = the caller -- never by company_users, never
// by anything a client could supply to widen the result.

async function getMyTours(userId) {
  const result = await pool.query(
    `SELECT t.*, p.id AS participant_id, tp.status AS participation_status
     FROM tour_participants tp
     JOIN participants p ON p.id = tp.participant_id
     JOIN tours t ON t.id = tp.tour_id
     WHERE p.user_id = $1
     ORDER BY t.start_date DESC`,
    [userId]
  );
  return result.rows;
}

async function getMyTourProgram(tourId) {
  const days = await pool.query("SELECT * FROM tour_days WHERE tour_id = $1 ORDER BY day_number", [tourId]);
  const activities = await pool.query(
    `SELECT a.* FROM activities a
     JOIN tour_days td ON td.id = a.tour_day_id
     WHERE td.tour_id = $1
     ORDER BY a.start_time ASC NULLS LAST`,
    [tourId]
  );

  return days.rows.map((day) => ({
    ...day,
    activities: activities.rows.filter((a) => a.tour_day_id === day.id),
  }));
}

async function getMyTourFlights(tourId, participantId) {
  const result = await pool.query(
    `SELECT f.*, fp.seat_number, fp.ticket_number, fp.status AS participant_status
     FROM flight_participants fp
     JOIN flights f ON f.id = fp.flight_id
     WHERE f.tour_id = $1 AND fp.participant_id = $2
     ORDER BY f.departure_datetime`,
    [tourId, participantId]
  );
  return result.rows;
}

async function getMyTourHotels(tourId, participantId) {
  const result = await pool.query(
    `SELECT h.*, hr.room_number, hr.room_type, hrp.status AS participant_status,
            hrp.check_in AS my_check_in, hrp.check_out AS my_check_out
     FROM hotel_room_participants hrp
     JOIN hotel_rooms hr ON hr.id = hrp.room_id
     JOIN hotels h ON h.id = hr.hotel_id
     WHERE h.tour_id = $1 AND hrp.participant_id = $2
     ORDER BY h.check_in`,
    [tourId, participantId]
  );
  return result.rows;
}

async function getMyTourAnnouncements(tourId) {
  const result = await pool.query(
    "SELECT * FROM announcements WHERE tour_id = $1 AND status = 'PUBLISHED' ORDER BY published_at DESC",
    [tourId]
  );
  return result.rows;
}

// Documents visible to a participant: general tour documents
// (participant_id IS NULL) or their own, and only when visibility
// explicitly allows participant viewing.
async function getMyTourDocuments(tourId, participantId) {
  const result = await pool.query(
    `SELECT id, tour_id, participant_id, title, description, category, file_name, file_url,
            mime_type, file_size, visibility, status, created_at, updated_at
     FROM documents
     WHERE tour_id = $1
       AND (participant_id IS NULL OR participant_id = $2)
       AND visibility IN ('PARTICIPANT', 'BOTH')
       AND status = 'ACTIVE'
     ORDER BY created_at DESC`,
    [tourId, participantId]
  );
  return result.rows;
}

// Single-document fetch for a participant, applying the same rule as
// the list above. Returns null (caller maps to 404) if not visible.
async function getMyDocumentById(tourId, participantId, documentId) {
  const result = await pool.query(
    `SELECT id, tour_id, participant_id, title, description, category, file_name, file_url,
            mime_type, file_size, visibility, status, created_at, updated_at
     FROM documents
     WHERE id = $1 AND tour_id = $2
       AND (participant_id IS NULL OR participant_id = $3)
       AND visibility IN ('PARTICIPANT', 'BOTH')
       AND status = 'ACTIVE'`,
    [documentId, tourId, participantId]
  );
  return result.rows[0] || null;
}

async function getMyTourPayments(tourId, participantId) {
  const sale = await pool.query(
    "SELECT sale_price, sale_currency, payment_status FROM tour_participants WHERE tour_id = $1 AND participant_id = $2",
    [tourId, participantId]
  );

  const transactions = await pool.query(
    `SELECT id, type, category, amount, currency, status, transaction_date, description, reference_number
     FROM finance_transactions
     WHERE tour_id = $1 AND participant_id = $2
     ORDER BY transaction_date DESC`,
    [tourId, participantId]
  );

  return {
    sale: sale.rows[0] || null,
    transactions: transactions.rows,
  };
}

module.exports = {
  getMyTours, getMyTourProgram, getMyTourFlights, getMyTourHotels,
  getMyTourAnnouncements, getMyTourDocuments, getMyDocumentById, getMyTourPayments,
};
