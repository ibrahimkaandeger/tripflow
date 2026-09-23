const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { getPermissionKeysForRole, assertWithinActorCeiling } = require("./permissionCeilingService");

// role_id must either be a global role (company_id IS NULL) or a
// custom role that belongs to THIS company -- never another
// company's custom role.
async function assertRoleUsableByCompany(roleId, companyId) {
  const result = await pool.query("SELECT company_id FROM roles WHERE id = $1", [roleId]);

  if (result.rows.length === 0) {
    throw new AppError(400, "INVALID_REFERENCE", "Geçersiz rol.");
  }

  const roleCompanyId = result.rows[0].company_id;

  if (roleCompanyId !== null && roleCompanyId !== companyId) {
    throw new AppError(400, "INVALID_REFERENCE", "Bu rol başka bir şirkete ait.");
  }
}

// Core RBAC invariant, applied to role ASSIGNMENT (as opposed to role
// PERMISSION editing, guarded separately in roleService): an actor
// can never hand out -- to themselves or anyone else -- a role whose
// permission set exceeds their own current one. Without this, an
// actor could sidestep roleService's ceiling check entirely by
// assigning an already-existing, more-privileged role (created by
// someone else, e.g. OWNER) instead of building one themselves.
async function assertActorCanGrantRole(actorRoleId, targetRoleId) {
  const targetKeys = await getPermissionKeysForRole(targetRoleId);
  await assertWithinActorCeiling(actorRoleId, targetKeys, "Atamak istediğiniz rol");
}

async function listCompanyUsers(companyId, query) {
  const { page, limit, offset } = parsePagination(query);

  const params = [companyId];
  let statusFilter = "";
  if (query.status) {
    params.push(query.status);
    statusFilter = ` AND cu.status = $${params.length}`;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM company_users cu WHERE cu.company_id = $1${statusFilter}`,
    params
  );

  const dataParams = [...params, limit, offset];
  const result = await pool.query(
    `SELECT cu.id, cu.company_id, cu.user_id, u.name, u.email, cu.role_id, r.name AS role_name,
            cu.status, cu.created_at, cu.updated_at
     FROM company_users cu
     JOIN users u ON u.id = cu.user_id
     JOIN roles r ON r.id = cu.role_id
     WHERE cu.company_id = $1${statusFilter}
     ORDER BY cu.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  return {
    data: result.rows,
    pagination: buildPaginationMeta(page, limit, Number(countResult.rows[0].count)),
  };
}

async function getCompanyUserById(companyId, id) {
  const result = await pool.query(
    `SELECT cu.id, cu.company_id, cu.user_id, u.name, u.email, cu.role_id, r.name AS role_name,
            cu.status, cu.created_at, cu.updated_at
     FROM company_users cu
     JOIN users u ON u.id = cu.user_id
     JOIN roles r ON r.id = cu.role_id
     WHERE cu.id = $1 AND cu.company_id = $2`,
    [id, companyId]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, "COMPANY_USER_NOT_FOUND", "Şirket kullanıcısı bulunamadı.");
  }

  return result.rows[0];
}

async function createCompanyUser(companyId, actorRoleId, body) {
  const { user_id, role_id, status } = body;

  if (!user_id || !role_id) {
    throw new AppError(400, "VALIDATION_ERROR", "user_id ve role_id zorunludur.");
  }

  const userExists = await pool.query("SELECT id FROM users WHERE id = $1", [user_id]);
  if (userExists.rows.length === 0) {
    throw new AppError(400, "INVALID_REFERENCE", "Geçersiz kullanıcı.");
  }

  await assertRoleUsableByCompany(role_id, companyId);
  await assertActorCanGrantRole(actorRoleId, role_id);

  try {
    const result = await pool.query(
      `INSERT INTO company_users (company_id, user_id, role_id, status)
       VALUES ($1, $2, $3, COALESCE($4, 'ACTIVE'))
       RETURNING id, company_id, user_id, role_id, status, created_at, updated_at`,
      [companyId, user_id, role_id, status]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu kullanıcı zaten bu şirkete üye.");
  }
}

async function updateCompanyUser(companyId, actorRoleId, id, body) {
  const { role_id, status } = body;
  const fields = [];
  const values = [];
  let i = 1;

  if (role_id !== undefined) {
    await assertRoleUsableByCompany(role_id, companyId);
    await assertActorCanGrantRole(actorRoleId, role_id);
    fields.push(`role_id = $${i}`);
    values.push(role_id);
    i++;
  }

  if (status !== undefined) {
    fields.push(`status = $${i}`);
    values.push(status);
    i++;
  }

  if (fields.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id, companyId);

  try {
    const result = await pool.query(
      `UPDATE company_users SET ${fields.join(", ")}
       WHERE id = $${i} AND company_id = $${i + 1}
       RETURNING id, company_id, user_id, role_id, status, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError(404, "COMPANY_USER_NOT_FOUND", "Şirket kullanıcısı bulunamadı.");
    }

    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    mapDbError(error, "Bu kullanıcı zaten bu şirkete üye.");
  }
}

module.exports = { listCompanyUsers, getCompanyUserById, createCompanyUser, updateCompanyUser };
