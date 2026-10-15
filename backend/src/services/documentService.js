const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireField, requireEnum, requirePositiveNumber, requireMaxLength, requireIntId, fail } = require("../utils/validate");
const { buildPaginationMeta } = require("../utils/pagination");
const { parseListQuery } = require("../utils/listQuery");

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
  requireMaxLength(body.title, 200, "title");
  requireMaxLength(body.file_name, 255, "file_name");
  requireMaxLength(body.mime_type, 100, "mime_type");
  if (body.participant_id !== undefined && body.participant_id !== null && body.participant_id !== "") {
    requireIntId(body.participant_id, "participant_id");
  }

  // The URL is rendered as a link in the UI, so only http(s) is allowed
  // (blocks javascript:/data: URLs from ever being stored).
  if (body.file_url !== undefined) {
    let url = null;
    try {
      url = new URL(body.file_url);
    } catch {
      url = null;
    }
    if (!url || !["http:", "https:"].includes(url.protocol) || body.file_url.length > 2048) {
      fail("file_url http:// veya https:// ile başlayan geçerli bir adres olmalı.");
    }
  }
}

// Every document of the company across all tours (newest first), with
// the tour title and the linked participant's name. Optional filters:
// tour, status, search (title / file name).
async function listDocuments(companyId, query) {
  const { page, limit, offset, tourId, status, search } = parseListQuery(query, { statuses: STATUSES });
  const conditions = ["t.company_id = $1"];
  const params = [companyId];

  if (tourId) { params.push(tourId); conditions.push(`d.tour_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`d.status = $${params.length}`); }
  if (search) {
    params.push(search);
    const p = `$${params.length}`;
    conditions.push(`(d.title ILIKE ${p} OR d.file_name ILIKE ${p})`);
  }

  const from = "documents d JOIN tours t ON t.id = d.tour_id LEFT JOIN participants p ON p.id = d.participant_id";
  const where = conditions.join(" AND ");
  const count = await pool.query(`SELECT COUNT(*) FROM ${from} WHERE ${where}`, params);
  const result = await pool.query(
    `SELECT d.*, t.title AS tour_title, p.first_name AS participant_first_name, p.last_name AS participant_last_name
     FROM ${from}
     WHERE ${where}
     ORDER BY d.created_at DESC, d.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { data: result.rows, pagination: buildPaginationMeta(page, limit, Number(count.rows[0].count)) };
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

module.exports = { listDocumentsForTour, listDocuments, getDocumentById, createDocument, updateDocument, deleteDocument };
