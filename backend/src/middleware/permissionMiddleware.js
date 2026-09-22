const pool = require("../config/db");
const AppError = require("../utils/AppError");

// Permission-based, not role-name-based: this never checks
// req.membership against "OWNER"/"ADMIN"/etc. It only asks the
// database whether the role attached to the current membership has
// been granted a given permission key. role_permissions (Phase 3) is
// the single source of truth, so a company's custom roles or future
// admin-managed permission changes take effect automatically without
// any change here.
//
// Must run after requireCompanyMembership (needs req.membership.roleId).
const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.membership) {
        throw new AppError(
          500,
          "MEMBERSHIP_NOT_RESOLVED",
          "Permission kontrolü öncesi company membership doğrulanmalı."
        );
      }

      const result = await pool.query(
        `SELECT 1
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = $1 AND p.key = $2`,
        [req.membership.roleId, permissionKey]
      );

      if (result.rows.length === 0) {
        throw new AppError(403, "PERMISSION_DENIED", "Bu işlem için yetkiniz yok.");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { requirePermission };
