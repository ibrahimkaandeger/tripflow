const AppError = require("../utils/AppError");

// Central error formatter for the Business API. Did not exist before
// this phase -- built now because the response format this phase
// itself requires ({ success:false, error:{code,message} }) needs one
// place to produce it consistently instead of every controller
// hand-rolling it. Not a general audit/logging framework, just the
// standard Express asyncHandler + errorHandler pair.
//
// Never leaks SQL text, stack traces, or raw pg error detail to the
// client -- those go to the server console only.
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  // body-parser errors (malformed JSON, oversized body) are client
  // errors, not server faults.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "İstek gövdesi geçerli bir JSON değil." },
    });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "İstek gövdesi çok büyük." },
    });
  }

  // Logged server-side only (message + stack), never sent to the client.
  console.error("Unhandled error:", err);

  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu." },
  });
};

module.exports = errorHandler;
