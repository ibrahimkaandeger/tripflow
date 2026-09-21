const pool = require("../config/db");

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

// Staff-side resource scoping: the resolved owning company must match
// the caller's authenticated company membership (req.membership, set
// by requireCompanyMembership). 404 on mismatch or not-found, never
// 403 -- confirming "this exists but isn't yours" leaks more than a
// plain "not found" does, and the master spec calls this out
// explicitly for cross-tenant access.
//
// Usage: router.get("/api/tours/:id/flights/:flightId", authMiddleware,
//   requireCompanyMembership, requirePermission("flights.read"),
//   requireResourceOwnership(getFlightCompanyId, "flightId"), controller)
function requireResourceOwnership(resolver, paramName = "id") {
  return async (req, res, next) => {
    const resourceId = Number(req.params[paramName]);

    if (!resourceId) {
      return res.status(404).json({
        success: false,
        message: "Kaynak bulunamadı.",
      });
    }

    try {
      const ownerCompanyId = await resolver(resourceId);

      if (ownerCompanyId === null || ownerCompanyId !== req.membership.companyId) {
        return res.status(404).json({
          success: false,
          message: "Kaynak bulunamadı.",
        });
      }

      next();
    } catch (error) {
      console.error("Resource ownership check error:", error);

      return res.status(500).json({
        success: false,
        message: "Kaynak erişimi kontrol edilirken beklenmeyen bir hata oluştu.",
      });
    }
  };
}

module.exports = {
  getTourCompanyId,
  getParticipantCompanyId,
  getFlightCompanyId,
  getHotelCompanyId,
  getAnnouncementCompanyId,
  getDocumentCompanyId,
  getDocumentParticipantId,
  getFinanceTransactionCompanyId,
  getFinanceTransactionParticipantId,
  requireResourceOwnership,
};
