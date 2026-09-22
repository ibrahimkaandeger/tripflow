const AppError = require("./AppError");

// Database constraints remain the final safety layer (section 22).
// This just maps the common Postgres error codes those constraints
// raise into the clean, non-leaking response shape the API promises
// -- never the raw SQL/constraint text. Call from a service's catch
// block; anything not recognized here is rethrown for errorHandler's
// generic 500 path.
function mapDbError(error, conflictMessage) {
  switch (error.code) {
    case "23505": // unique_violation
      throw new AppError(409, "CONFLICT", conflictMessage || "Bu kayıt zaten mevcut.");
    case "23503": // foreign_key_violation
      throw new AppError(400, "INVALID_REFERENCE", "Geçersiz veya var olmayan bir kayıt referans edildi.");
    case "23514": // check_violation
      throw new AppError(422, "CONSTRAINT_VIOLATION", "Girilen veri izin verilen kurallara uymuyor.");
    case "23001": // restrict_violation
      throw new AppError(409, "RESTRICTED", "Bu işlem, bağlı kayıtlar nedeniyle engellendi.");
    case "P0001": // raised by our own trigger functions
      throw new AppError(422, "SCOPE_VIOLATION", "Kaynak, beklenen tenant/tur kapsamının dışında.");
    default:
      throw error;
  }
}

module.exports = { mapDbError };
