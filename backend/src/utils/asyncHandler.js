// Wraps an async controller so a rejected promise reaches
// errorHandler.js instead of becoming an unhandled rejection.
// Keeps controllers free of repetitive try/catch (section 27: thin
// controllers, no duplicated logic).
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
