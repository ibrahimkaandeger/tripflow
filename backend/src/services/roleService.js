const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");

async function listRoles(companyId) {
  const result = await pool.query(
    `SELECT id, company_id, name, description, created_at, updated_at
     FROM roles
     WHERE company_id IS NULL OR company_id = $1
     ORDER BY company_id NULLS FIRST, name`,
    [companyId]
  );
  return result.rows;
}

// Global roles are visible to every company but only a company's own
// custom roles may ever be found "owned" by it -- callers that need
// to block edits on global roles check role.company_id === null
// themselves (see updateRole).
async function getRoleById(companyId, id) {
  const result = await pool.query(
    `SELECT id, company_id, name, description, created_at, updated_at
     FROM roles WHERE id = $1 AND (company_id IS NULL OR company_id = $2)`,
    [id, companyId]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, "ROLE_NOT_FOUND", "Rol bulunamadı.");
  }

  return result.rows[0];
}

async function createRole(companyId, body) {
  const { name, description } = body;

  if (!name) {
    throw new AppError(400, "VALIDATION_ERROR", "name zorunludur.");
  }

  try {
    const result = await pool.query(
      `INSERT INTO roles (company_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, company_id, name, description, created_at, updated_at`,
      [companyId, name, description || null]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu isimde bir rol zaten mevcut.");
  }
}

async function updateRole(companyId, id, body) {
  const role = await getRoleById(companyId, id);

  // Never allow editing a global role or another company's role
  // through this endpoint. getRoleById already filtered to global-or-
  // mine, so the only remaining unsafe case is "global" -- a company
  // cannot rename/redescribe OWNER/ADMIN/MANAGER/STAFF, nor can this
  // path ever touch company_id itself (never read from body).
  if (role.company_id === null) {
    throw new AppError(403, "GLOBAL_ROLE_READONLY", "Global roller bu uçtan değiştirilemez.");
  }

  const { name, description } = body;
  const fields = [];
  const values = [];
  let i = 1;

  if (name !== undefined) {
    fields.push(`name = $${i}`);
    values.push(name);
    i++;
  }
  if (description !== undefined) {
    fields.push(`description = $${i}`);
    values.push(description);
    i++;
  }

  if (fields.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id, companyId);

  try {
    const result = await pool.query(
      `UPDATE roles SET ${fields.join(", ")} WHERE id = $${i} AND company_id = $${i + 1}
       RETURNING id, company_id, name, description, created_at, updated_at`,
      values
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu isimde bir rol zaten mevcut.");
  }
}

async function getRolePermissions(companyId, id) {
  await getRoleById(companyId, id);

  const result = await pool.query(
    `SELECT p.id, p.key, p.description
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = $1
     ORDER BY p.key`,
    [id]
  );

  return result.rows;
}

async function setRolePermissions(companyId, id, permissionIds) {
  const role = await getRoleById(companyId, id);

  if (role.company_id === null) {
    throw new AppError(403, "GLOBAL_ROLE_READONLY", "Global rollerin yetkileri bu uçtan değiştirilemez.");
  }

  if (!Array.isArray(permissionIds)) {
    throw new AppError(400, "VALIDATION_ERROR", "permissionIds bir dizi olmalı.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM role_permissions WHERE role_id = $1", [id]);

    for (const permissionId of permissionIds) {
      await client.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)",
        [id, permissionId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    mapDbError(error, "Geçersiz yetki listesi.");
  } finally {
    client.release();
  }

  return getRolePermissions(companyId, id);
}

module.exports = { listRoles, getRoleById, createRole, updateRole, getRolePermissions, setRolePermissions };
