const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { requireIntId } = require("../utils/validate");

// Resolves the owning company_id for a resource, following the exact
// chains described for this phase (tour.company_id direct;
// flight/hotel/announcement/document via tour_id -> tours.company_id;
// participant/finance_transactions.company_id direct). Returns null
// when the resource doesn't exist, which requireResourceOwnership
// below treats the same as "belongs to a different company" -- so a
// nonexistent id and someone else's resource are indistinguishable to
// the caller (404 either way), which is deliberate: it avoids
// confirming that a given id exists in another tenant.

async function getTourCompanyId(tourId) {
  const result = await pool.query(
    "SELECT company_id FROM tours WHERE id = $1",
    [tourId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getParticipantCompanyId(participantId) {
  const result = await pool.query(
    "SELECT company_id FROM participants WHERE id = $1",
    [participantId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getTourDayCompanyId(tourDayId) {
  const result = await pool.query(
    `SELECT t.company_id
     FROM tour_days td
     JOIN tours t ON t.id = td.tour_id
     WHERE td.id = $1`,
    [tourDayId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getActivityCompanyId(activityId) {
  const result = await pool.query(
    `SELECT t.company_id
     FROM activities a
     JOIN tour_days td ON td.id = a.tour_day_id
     JOIN tours t ON t.id = td.tour_id
     WHERE a.id = $1`,
    [activityId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getFlightCompanyId(flightId) {
  const result = await pool.query(
    `SELECT t.company_id
     FROM flights f
     JOIN tours t ON t.id = f.tour_id
     WHERE f.id = $1`,
    [flightId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getHotelCompanyId(hotelId) {
  const result = await pool.query(
    `SELECT t.company_id
     FROM hotels h
     JOIN tours t ON t.id = h.tour_id
     WHERE h.id = $1`,
    [hotelId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getHotelRoomCompanyId(roomId) {
  const result = await pool.query(
    `SELECT t.company_id
     FROM hotel_rooms hr
     JOIN hotels h ON h.id = hr.hotel_id
     JOIN tours t ON t.id = h.tour_id
     WHERE hr.id = $1`,
    [roomId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getAnnouncementCompanyId(announcementId) {
  const result = await pool.query(
    `SELECT t.company_id
     FROM announcements a
     JOIN tours t ON t.id = a.tour_id
     WHERE a.id = $1`,
    [announcementId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getDocumentCompanyId(documentId) {
  const result = await pool.query(
    `SELECT t.company_id
     FROM documents d
     JOIN tours t ON t.id = d.tour_id
     WHERE d.id = $1`,
    [documentId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getDocumentParticipantId(documentId) {
  const result = await pool.query(
    "SELECT participant_id FROM documents WHERE id = $1",
    [documentId]
  );
  return result.rows[0] ? result.rows[0].participant_id : null;
}

async function getFinanceTransactionCompanyId(financeTransactionId) {
  const result = await pool.query(
    "SELECT company_id FROM finance_transactions WHERE id = $1",
    [financeTransactionId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getFinanceTransactionParticipantId(financeTransactionId) {
  const result = await pool.query(
    "SELECT participant_id FROM finance_transactions WHERE id = $1",
    [financeTransactionId]
  );
  return result.rows[0] ? result.rows[0].participant_id : null;
}

async function getCompanyUserCompanyId(companyUserId) {
  const result = await pool.query(
    "SELECT company_id FROM company_users WHERE id = $1",
    [companyUserId]
  );
  return result.rows[0] ? result.rows[0].company_id : null;
}

async function getRoleCompanyId(roleId) {
  const result = await pool.query(
    "SELECT company_id FROM roles WHERE id = $1",
    [roleId]
  );
  // NULL company_id on a role row means it's a global role, not "no
  // such role" -- callers decide separately whether global roles are
  // allowed for the operation in question.
  return result.rows[0] ? result.rows[0].company_id : undefined;
}

// Staff-side resource scoping: the resolved owning company must match
// the caller's authenticated company membership (req.membership, set
// by requireCompanyMembership). 404 on mismatch or not-found, never
// 403 -- confirming "this exists but isn't yours" leaks more than a
// plain "not found" does, and the master spec calls this out
// explicitly for cross-tenant access.
function requireResourceOwnership(resolver, paramName = "id") {
  return async (req, res, next) => {
    try {
      // Malformed ids ("abc", "1.5", beyond INTEGER range) are a 400
      // before any query runs; a well-formed id that doesn't exist (or
      // belongs to another company) is still the indistinguishable 404.
      const resourceId = requireIntId(req.params[paramName], paramName);

      const ownerCompanyId = await resolver(resourceId);

      if (ownerCompanyId === null || ownerCompanyId !== req.membership.companyId) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Kaynak bulunamadı.");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  getTourCompanyId,
  getParticipantCompanyId,
  getTourDayCompanyId,
  getActivityCompanyId,
  getFlightCompanyId,
  getHotelCompanyId,
  getHotelRoomCompanyId,
  getAnnouncementCompanyId,
  getDocumentCompanyId,
  getDocumentParticipantId,
  getFinanceTransactionCompanyId,
  getFinanceTransactionParticipantId,
  getCompanyUserCompanyId,
  getRoleCompanyId,
  requireResourceOwnership,
};
