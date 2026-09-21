const pool = require("../config/db");

// Determines company access via company_users, never via users alone.
// Must run after authMiddleware (needs req.user.id) and expects the
// target company id as a route param named companyId, e.g.:
//
//   router.get(
//     "/api/companies/:companyId/tours",
//     authMiddleware,
//     requireCompanyMembership,
//     requirePermission("tours.read"),
//     listTours
//   );
//
// On success, attaches req.membership = { companyId, roleId } for
// requirePermission and resource-ownership checks to use.
const requireCompanyMembership = async (req, res, next) => {
  const companyId = Number(req.params.companyId);

  if (!companyId) {
    return res.status(400).json({
      success: false,
      message: "Geçerli bir company ID gerekli.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT company_id, role_id, status
       FROM company_users
       WHERE company_id = $1 AND user_id = $2`,
      [companyId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Bu şirkete üye değilsiniz.",
      });
    }

    const membership = result.rows[0];

    if (membership.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Şirket üyeliğiniz aktif değil.",
      });
    }

    req.membership = {
      companyId: membership.company_id,
      roleId: membership.role_id,
    };

    next();
  } catch (error) {
    console.error("Company membership middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Şirket üyeliği kontrol edilirken beklenmeyen bir hata oluştu.",
    });
  }
};

module.exports = { requireCompanyMembership };
