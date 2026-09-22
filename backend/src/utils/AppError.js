// Thrown by services/controllers for expected failure cases
// (validation, not found, conflict, forbidden). errorHandler.js
// turns these into the standard { success:false, error:{code,message} }
// response with the right HTTP status. Anything else thrown (a real
// bug, a raw pg error) is treated as 500 and never shown to the
// client in detail.
class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = AppError;
