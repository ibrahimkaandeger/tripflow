const pool = require("../config/db");
const AppError = require("../utils/AppError");

// Determines company access via company_users, never via users alone.
// Must run after authMiddleware (needs req.user.id).
//
// The company id is resolved, in order:
//   1. req.params.companyId (nested routes, e.g. /api/companies/:companyId/...)
//   2. X-Company-Id header
//   3. ?companyId= query param
//   4. the caller's own membership, IF they belong to exactly one
//      ACTIVE company -- this is what makes flat routes like
//      GET /api/tours work without any client-supplied id at all.
// Whichever value is picked is only ever used as a lookup key into
// company_users for req.user.id -- it is never trusted as the
// authority on its own, so a client sending someone else's company id
// still gets rejected below unless they're actually a member.
//
// On success, attaches req.membership = { companyId, roleId } for
// requirePermission and resource-ownership checks to use.
async function resolveCompanyId(req) {
  if (req.params.companyId) {
    return Number(req.params.companyId);
  }

  const headerValue = req.headers["x-company-id"];
  if (headerValue) {
    return Number(headerValue);
  }

  if (req.query.companyId) {
    return Number(req.query.companyId);
  }

  const result = await pool.query(
    `SELECT company_id FROM company_users WHERE user_id = $1 AND status = 'ACTIVE'`,
    [req.user.id]
  );

  if (result.rows.length === 1) {
    return result.rows[0].company_id;
  }

  return null;
}

const requireCompanyMembership = async (req, res, next) => {
  try {
    const companyId = await resolveCompanyId(req);

    if (!companyId) {
      throw new AppError(
        400,
        "COMPANY_CONTEXT_REQUIRED",
        "Şirket bağlamı belirlenemedi. Birden fazla şirket üyeliğiniz varsa X-Company-Id header'ı ile belirtin."
      );
    }

    const result = await pool.query(
      `SELECT company_id, role_id, status
       FROM company_users
       WHERE company_id = $1 AND user_id = $2`,
      [companyId, req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError(403, "NOT_COMPANY_MEMBER", "Bu şirkete üye değilsiniz.");
    }

    const membership = result.rows[0];

    if (membership.status !== "ACTIVE") {
      throw new AppError(403, "MEMBERSHIP_INACTIVE", "Şirket üyeliğiniz aktif değil.");
    }

    req.membership = {
      companyId: membership.company_id,
      roleId: membership.role_id,
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireCompanyMembership };
