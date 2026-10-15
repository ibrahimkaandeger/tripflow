const express = require("express");

const {
  createUser,
  loginUser,
  getMe,
} = require("../controllers/userController");

const authMiddleware = require("../middleware/authMiddleware");
const { loginRateLimit, registerRateLimit } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/", registerRateLimit, createUser);

router.post("/login", loginRateLimit, loginUser);

router.get("/me", authMiddleware, getMe);

module.exports = router;
