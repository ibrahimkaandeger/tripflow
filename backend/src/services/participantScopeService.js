const pool = require("../config/db");
const AppError = require("../utils/AppError");

// Participant-side access. Deliberately separate from
// resourceScopeService/companyMiddleware: a participant is never a
// company staff member, even if the same user account happens to
// also be one (Phase 6 allows both to exist independently). These
// helpers never consult company_users or role_permissions -- they
// only ever ask "does participants.user_id = the caller own this."

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
  try {
    const tourId = Number(req.params.tourId);

    if (!tourId) {
      throw new AppError(404, "TOUR_NOT_FOUND", "Tur bulunamadı.");
    }

    const result = await pool.query(
      `SELECT tp.participant_id
       FROM tour_participants tp
       JOIN participants p ON p.id = tp.participant_id
       WHERE p.user_id = $1 AND tp.tour_id = $2`,
      [req.user.id, tourId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, "TOUR_NOT_FOUND", "Tur bulunamadı.");
    }

    req.participantScope = {
      tourId,
      participantId: result.rows[0].participant_id,
    };

    next();
  } catch (error) {
    next(error);
  }
};

// A participant may only reach a resource (document, finance
// transaction, ...) whose participant_id is one of THEIR OWN
// participant records -- never another participant's, even within
// the same tour. resolver(resourceId) must resolve to that resource's
// owning participant_id (or null).
function requireOwnParticipantResource(resolver, paramName = "id") {
  return async (req, res, next) => {
    try {
      const resourceId = Number(req.params[paramName]);

      if (!resourceId) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Kaynak bulunamadı.");
      }

      const ownerParticipantId = await resolver(resourceId);
      const myParticipantIds = await getParticipantIdsForUser(req.user.id);

      if (ownerParticipantId === null || !myParticipantIds.includes(ownerParticipantId)) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Kaynak bulunamadı.");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  getParticipantIdsForUser,
  requireParticipantTourAccess,
  requireOwnParticipantResource,
};
