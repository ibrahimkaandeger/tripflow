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
// The single permission lookup. Exported so a handler can branch on a
// permission (e.g. hide fields) without a second copy of this query.
async function roleHasPermission(roleId, permissionKey) {
  const result = await pool.query(
    `SELECT 1
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = $1 AND p.key = $2`,
    [roleId, permissionKey]
  );
  return result.rows.length > 0;
}

function assertMembershipResolved(req) {
  if (!req.membership) {
    throw new AppError(
      500,
      "MEMBERSHIP_NOT_RESOLVED",
      "Permission kontrolü öncesi company membership doğrulanmalı."
    );
  }
}

// Must run after requireCompanyMembership (needs req.membership.roleId).
const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      assertMembershipResolved(req);

      if (!(await roleHasPermission(req.membership.roleId, permissionKey))) {
        throw new AppError(403, "PERMISSION_DENIED", "Bu işlem için yetkiniz yok.");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Field-level gate on top of the route's own permission: if the request
// body contains ANY of `fields`, the caller must also hold
// `permissionKey`. Bodies without those fields pass straight through,
// so the route's base permission alone keeps governing them. Used for
// financial columns on tour_participants, which participants.update
// must not be able to change without finance.update.
const requirePermissionForFields = (fields, permissionKey) => {
  return async (req, res, next) => {
    try {
      assertMembershipResolved(req);

      const body = req.body || {};
      const touched = fields.filter((field) => body[field] !== undefined);

      if (touched.length > 0 && !(await roleHasPermission(req.membership.roleId, permissionKey))) {
        throw new AppError(
          403,
          "PERMISSION_DENIED",
          `${touched.join(", ")} alanlarını değiştirmek için ${permissionKey} yetkisi gerekli.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { requirePermission, requirePermissionForFields, roleHasPermission };
