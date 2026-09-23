const pool = require("../config/db");
const AppError = require("../utils/AppError");

// Single enforcement point for the core RBAC invariant: an actor can
// never grant, to a role or to another (or their own) company_users
// row, a permission their own current role does not itself hold.
// Used by:
//   - roleService.setRolePermissions   (granting permissions TO a role)
//   - companyUserService.create/updateCompanyUser (granting a ROLE,
//     and transitively its whole permission set, to a user)
// Deliberately kept as the one place this is computed, rather than
// duplicated in each service, so there is exactly one implementation
// to trust for this security boundary. No new permission key or
// database column: this reads the existing role_permissions/
// permissions tables exactly as requirePermission does.

async function getPermissionKeysForRole(roleId) {
  const result = await pool.query(
    `SELECT p.key
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = $1`,
    [roleId]
  );
  return new Set(result.rows.map((row) => row.key));
}

// Throws 403 if targetKeys contains any permission key that
// actorRoleId's own role does not currently grant. actionLabel makes
// the resulting message specific to the caller's context (editing a
// role's permissions vs. assigning a role to a user) without needing
// two near-duplicate implementations.
async function assertWithinActorCeiling(actorRoleId, targetKeys, actionLabel) {
  const actorKeys = await getPermissionKeysForRole(actorRoleId);
  const notOwned = [...targetKeys].filter((key) => !actorKeys.has(key));

  if (notOwned.length > 0) {
    throw new AppError(
      403,
      "PRIVILEGE_CEILING_EXCEEDED",
      `${actionLabel} sahip olmadığınız şu yetkileri içeriyor: ${notOwned.join(", ")}.`
    );
  }
}

module.exports = { getPermissionKeysForRole, assertWithinActorCeiling };
