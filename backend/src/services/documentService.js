const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireField, requireEnum, requirePositiveNumber } = require("../utils/validate");

const CATEGORIES = ["PASSPORT", "TICKET", "VISA", "PROGRAM", "CONTRACT", "INSURANCE", "OTHER"];
const VISIBILITIES = ["COMPANY_ONLY", "PARTICIPANT", "BOTH"];
const STATUSES = ["ACTIVE", "ARCHIVED"];
const UPDATABLE_FIELDS = ["title", "description", "category", "file_name", "file_url", "mime_type", "file_size", "visibility", "status"];

function validateInput(body, { partial = false } = {}) {
  for (const field of ["title", "category", "file_name", "file_url"]) {
    if (!partial || body[field] !== undefined) requireField(body, field);
  }
  requireEnum(body.category, CATEGORIES, "category");
  requireEnum(body.visibility, VISIBILITIES, "visibility");
  requireEnum(body.status, STATUSES, "status");
  requirePositiveNumber(body.file_size, "file_size");
}

async function listDocumentsForTour(tourId) {
  const result = await pool.query("SELECT * FROM documents WHERE tour_id = $1 ORDER BY created_at DESC", [tourId]);
  return result.rows;
}

async function getDocumentById(id) {
  const result = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
  if (result.rows.length === 0) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Belge bulunamadı.");
  return result.rows[0];
}

// file_url/file_name/mime_type/file_size are metadata only -- no
// actual cloud storage integration in this phase (explicitly out of
// scope); the client is expected to have already stored the file
// somewhere and supplies the resulting URL.
async function createDocument(tourId, userId, body) {
  validateInput(body);

  try {
    const result = await pool.query(
      `INSERT INTO documents (tour_id, participant_id, title, description, category, file_name, file_url, mime_type, file_size, visibility, status, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'COMPANY_ONLY'), COALESCE($11, 'ACTIVE'), $12)
       RETURNING *`,
      [tourId, body.participant_id || null, body.title, body.description || null, body.category,
       body.file_name, body.file_url, body.mime_type || null, body.file_size || null,
       body.visibility, body.status, userId]
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function updateDocument(id, body) {
  await getDocumentById(id);
  validateInput(body, { partial: true });

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
  if (fields.length === 0) throw new AppError(400, "VALIDATION_ERROR", "Güncellenecek en az bir alan gerekli.");
  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  try {
    const result = await pool.query(`UPDATE documents SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function deleteDocument(id) {
  await getDocumentById(id);
  await pool.query("DELETE FROM documents WHERE id = $1", [id]);
}

module.exports = { listDocumentsForTour, getDocumentById, createDocument, updateDocument, deleteDocument };
