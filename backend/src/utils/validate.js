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
  parseId,
};
