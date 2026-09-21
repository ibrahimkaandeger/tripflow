const express = require("express");

const {
  createUser,
  loginUser,
  getMe,
} = require("../controllers/userController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", createUser);

router.post("/login", loginUser);

router.get("/me", authMiddleware, getMe);

module.exports = router;