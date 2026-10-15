const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireEnum, requireEmail, requireMaxLength, fail } = require("../utils/validate");

const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];

const UPDATABLE_FIELDS = [
  "name", "legal_name", "email", "phone", "website",
  "address", "city", "country", "tax_number", "logo_url", "status",
];

// VARCHAR limits from 002_companies.sql.
const MAX_LENGTHS = {
  name: 200, legal_name: 200, email: 255, phone: 50, website: 255,
  city: 100, country: 100, tax_number: 50,
};

function validateCompanyInput(body, { partial = false } = {}) {
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) fail("name zorunludur.");
  }
  for (const [field, max] of Object.entries(MAX_LENGTHS)) {
    requireMaxLength(body[field], max, field);
  }
  requireEmail(body.email, "email");
  requireEnum(body.status, STATUSES, "status");
}

async function getCompanyById(companyId) {
  const result = await pool.query("SELECT * FROM companies WHERE id = $1", [companyId]);
  if (result.rows.length === 0) {
    throw new AppError(404, "COMPANY_NOT_FOUND", "Şirket bulunamadı.");
  }
  return result.rows[0];
}

// Creates a company and makes userId its OWNER. Runs on the caller's
// client so it can take part in a larger transaction (registration);
// the caller owns BEGIN/COMMIT.
async function createCompanyWithOwner(client, userId, body) {
  validateCompanyInput(body);

  const company = await client.query(
    "INSERT INTO companies (name, email, phone, city, country) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [body.name.trim(), body.email || null, body.phone || null, body.city || null, body.country || null]
  );

  const ownerRole = await client.query(
    "SELECT id FROM roles WHERE company_id IS NULL AND name = 'OWNER'"
  );
  if (ownerRole.rows.length === 0) {
    throw new Error("Global OWNER role is missing (migration 003).");
  }

  await client.query(
    "INSERT INTO company_users (company_id, user_id, role_id, status) VALUES ($1, $2, $3, 'ACTIVE')",
    [company.rows[0].id, userId, ownerRole.rows[0].id]
  );

  return company.rows[0];
}

// Onboarding for an existing account that has no company yet. A user
// who already has an active membership can't open a second company
// here: flat routes (GET /tours, ...) resolve the company from the
// caller's single active membership, and a second one would make every
// request ambiguous without an X-Company-Id header.
async function createCompanyForUser(userId, body) {
  const existing = await pool.query(
    "SELECT 1 FROM company_users WHERE user_id = $1 AND status = 'ACTIVE'",
    [userId]
  );
  if (existing.rows.length > 0) {
    throw new AppError(409, "ALREADY_IN_COMPANY", "Zaten aktif bir şirket üyeliğiniz var.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const company = await createCompanyWithOwner(client, userId, body);
    await client.query("COMMIT");
    return company;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error instanceof AppError) throw error;
    mapDbError(error, "Bu e-posta veya vergi numarası başka bir şirkete ait.");
  } finally {
    client.release();
  }
}

async function updateCompany(companyId, body) {
  validateCompanyInput(body, { partial: true });

  const fields = [];
  const values = [];
  let i = 1;

  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${i}`);
      values.push(body[field] === "" && field !== "name" ? null : body[field]);
      i++;
    }
  }

  if (fields.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(companyId);

  try {
    const result = await pool.query(
      `UPDATE companies SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error, "Bu e-posta veya vergi numarası başka bir şirkete ait.");
  }
}

// The caller's role and effective permission keys in the resolved
// company. Used by the frontend to show/hide actions; the API still
// enforces every permission itself.
async function getMembershipPermissions(membership) {
  const result = await pool.query(
    `SELECT r.name AS role_name, c.name AS company_name,
            COALESCE(array_agg(p.key ORDER BY p.key) FILTER (WHERE p.key IS NOT NULL), '{}') AS permissions
     FROM roles r
     JOIN companies c ON c.id = $2
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE r.id = $1
     GROUP BY r.name, c.name`,
    [membership.roleId, membership.companyId]
  );

  const row = result.rows[0];
  return {
    company_id: membership.companyId,
    company_name: row.company_name,
    role: row.role_name,
    permissions: row.permissions,
  };
}

module.exports = {
  getCompanyById,
  createCompanyWithOwner,
  createCompanyForUser,
  updateCompany,
  getMembershipPermissions,
};
