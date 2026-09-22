const pool = require("../config/db");
const AppError = require("../utils/AppError");

const UPDATABLE_FIELDS = [
  "name", "legal_name", "email", "phone", "website",
  "address", "city", "country", "tax_number", "logo_url", "status",
];

async function getCompanyById(companyId) {
  const result = await pool.query("SELECT * FROM companies WHERE id = $1", [companyId]);
  if (result.rows.length === 0) {
    throw new AppError(404, "COMPANY_NOT_FOUND", "Şirket bulunamadı.");
  }
  return result.rows[0];
}

async function updateCompany(companyId, body) {
  const fields = [];
  const values = [];
  let i = 1;

  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${i}`);
      values.push(body[field]);
      i++;
    }
  }

  if (fields.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(companyId);

  const result = await pool.query(
    `UPDATE companies SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );

  return result.rows[0];
}

module.exports = { getCompanyById, updateCompany };
