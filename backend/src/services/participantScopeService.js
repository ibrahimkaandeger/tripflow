const pool = require("../config/db");

// Participant-side access. Deliberately separate from
// resourceScopeService/companyMiddleware: a participant is never a
// company staff member, even if the same user account happens to
// also be one (Phase 6 allows both to exist independently). These
// helpers never consult company_users or role_permissions -- they
// only ever ask "does participants.user_id = the caller own this."
//
// Usage for a /api/me/tours/:tourId/* style route:
//   router.get("/api/me/tours/:tourId/program", authMiddleware,
//     requireParticipantTourAccess, controller)

async function getParticipantIdsForUser(userId) {
  const result = await pool.query(
    "SELECT id FROM participants WHERE user_id = $1",
    [userId]
  );
  return result.rows.map((row) => row.id);
}

// A participant may only reach a tour they are actually registered on
// via tour_participants -- not merely "same company," and not merely
// "has a participant record somewhere." 404 (not 403) on failure, so
// a tour id that exists elsewhere in the system is indistinguishable
// from one that doesn't exist at all.
const requireParticipantTourAccess = async (req, res, next) => {
  const tourId = Number(req.params.tourId);

  if (!tourId) {
    return res.status(404).json({
      success: false,
      message: "Tur bulunamadı.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT 1
       FROM tour_participants tp
       JOIN participants p ON p.id = tp.participant_id
       WHERE p.user_id = $1 AND tp.tour_id = $2`,
      [req.user.id, tourId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tur bulunamadı.",
      });
    }

    next();
  } catch (error) {
    console.error("Participant tour access check error:", error);

    return res.status(500).json({
      success: false,
      message: "Erişim kontrol edilirken beklenmeyen bir hata oluştu.",
    });
  }
};

// A participant may only reach a resource (document, finance
// transaction, ...) whose participant_id is one of THEIR OWN
// participant records -- never another participant's, even within
// the same tour. resolver(resourceId) must resolve to that resource's
// owning participant_id (or null).
function requireOwnParticipantResource(resolver, paramName = "id") {
  return async (req, res, next) => {
    const resourceId = Number(req.params[paramName]);

    if (!resourceId) {
      return res.status(404).json({
        success: false,
        message: "Kaynak bulunamadı.",
      });
    }

    try {
      const ownerParticipantId = await resolver(resourceId);
      const myParticipantIds = await getParticipantIdsForUser(req.user.id);

      if (ownerParticipantId === null || !myParticipantIds.includes(ownerParticipantId)) {
        return res.status(404).json({
          success: false,
          message: "Kaynak bulunamadı.",
        });
      }

      next();
    } catch (error) {
      console.error("Participant resource ownership check error:", error);

      return res.status(500).json({
        success: false,
        message: "Kaynak erişimi kontrol edilirken beklenmeyen bir hata oluştu.",
      });
    }
  };
}

module.exports = {
  getParticipantIdsForUser,
  requireParticipantTourAccess,
  requireOwnParticipantResource,
};
