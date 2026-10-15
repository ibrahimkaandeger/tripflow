const jwt = require("jsonwebtoken");

// Single place tokens are issued, so the payload shape and lifetime
// (JWT_EXPIRES_IN, default 7d) can't drift between register and login.
function signUserToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

module.exports = { signUserToken };
