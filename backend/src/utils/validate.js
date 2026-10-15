const AppError = require("./AppError");

// Small, shared validation primitives -- not a schema library. Each
// throws a 400 AppError with a specific message on failure. Database
// CHECK/FK constraints remain the final safety net; these just give
// clean, predictable 400 responses for normal bad input instead of
// surfacing raw Postgres errors.

function fail(message) {
  throw new AppError(400, "VALIDATION_ERROR", message);
}

function requireField(body, field) {
  if (body[field] === undefined || body[field] === null || body[field] === "") {
    fail(`${field} zorunludur.`);
  }
  return body[field];
}

function requireEnum(value, allowed, field) {
  if (value !== undefined && value !== null && !allowed.includes(value)) {
    fail(`${field} şu değerlerden biri olmalı: ${allowed.join(", ")}.`);
  }
  return value;
}

function requirePositiveNumber(value, field) {
  if (value === undefined || value === null) return value;
  const num = Number(value);
  if (Number.isNaN(num) || num <= 0) {
    fail(`${field} pozitif bir sayı olmalı.`);
  }
  return num;
}

function requireValidDate(value, field) {
  if (value === undefined || value === null) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    fail(`${field} geçerli bir tarih olmalı.`);
  }
  return value;
}

// Upper bound of a PostgreSQL INTEGER (SERIAL) column. Anything larger
// can't be a real id and would make Postgres throw instead of simply
// finding no row.
const MAX_INT4 = 2147483647;

// Strict positive-integer id: digits only (rejects "1.5", "-1", "abc",
// "1e3") and within INTEGER range. 400 on failure -- malformed input,
// as opposed to a well-formed id that simply doesn't exist (404).
function requireIntId(value, field) {
  const isDigits =
    (typeof value === "string" && /^\d+$/.test(value)) ||
    (typeof value === "number" && Number.isInteger(value));
  const id = Number(value);

  if (!isDigits || id <= 0 || id > MAX_INT4) {
    fail(`${field} geçerli bir pozitif tam sayı ID olmalı.`);
  }
  return id;
}

// Strict calendar date for DATE filters: exactly YYYY-MM-DD and a real
// day. new Date() alone is not enough -- it silently rolls
// "2026-02-30" over to March 2, which Postgres then rejects with a 500.
function requireDateOnly(value, field) {
  if (value === undefined || value === null) return value;

  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : null;

  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    fail(`${field} YYYY-MM-DD formatında geçerli bir tarih olmalı.`);
  }
  return value;
}

// Date + time for TIMESTAMP columns ("2026-10-01T09:30", optional
// seconds / timezone). The calendar part gets the same strict check as
// requireDateOnly so an impossible day can't reach Postgres.
function requireDateTime(value, field) {
  if (value === undefined || value === null) return value;

  const match = typeof value === "string"
    && /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value);

  if (!match || Number(match[2]) > 23 || Number(match[3]) > 59 || Number.isNaN(new Date(value).getTime())) {
    fail(`${field} geçerli bir tarih ve saat olmalı (YYYY-MM-DDTHH:MM).`);
  }
  requireDateOnly(match[1], field);
  return value;
}

// TIME columns: "HH:MM" or "HH:MM:SS".
function requireTime(value, field) {
  if (value === undefined || value === null || value === "") return value;
  const match = typeof value === "string" && /^(\d{2}):(\d{2})(:(\d{2}))?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[4] || 0) > 59) {
    fail(`${field} HH:MM formatında geçerli bir saat olmalı.`);
  }
  return value;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireEmail(value, field = "email") {
  if (value === undefined || value === null || value === "") return value;
  if (typeof value !== "string" || value.length > 255 || !EMAIL_REGEX.test(value)) {
    fail(`${field} geçerli bir e-posta adresi olmalı.`);
  }
  return value;
}

// Mirrors VARCHAR(n) limits so an over-long value is a 400, not a
// Postgres "value too long" 500.
function requireMaxLength(value, max, field) {
  if (value === undefined || value === null) return value;
  if (String(value).length > max) {
    fail(`${field} en fazla ${max} karakter olabilir.`);
  }
  return value;
}

function parseId(value, label = "ID") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(404, "RESOURCE_NOT_FOUND", `Geçersiz ${label}.`);
  }
  return id;
}

module.exports = {
  fail,
  requireField,
  requireEnum,
  requirePositiveNumber,
  requireValidDate,
  requireIntId,
  requireDateOnly,
  requireDateTime,
  requireTime,
  requireEmail,
  requireMaxLength,
  EMAIL_REGEX,
  parseId,
};
