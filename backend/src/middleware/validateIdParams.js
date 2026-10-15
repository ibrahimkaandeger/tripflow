const { requireIntId } = require("../utils/validate");

// Rejects malformed numeric route ids (e.g. "1.5", "abc", "-1", or
// beyond INTEGER range) with 400 before they reach Postgres, which
// would otherwise throw a 500. A well-formed id that doesn't exist
// still flows on to the normal 404 handling. Placed right after
// authMiddleware so 401 keeps priority.
const validateIdParams = (...paramNames) => {
  return (req, res, next) => {
    try {
      for (const name of paramNames) {
        requireIntId(req.params[name], name);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { validateIdParams };
