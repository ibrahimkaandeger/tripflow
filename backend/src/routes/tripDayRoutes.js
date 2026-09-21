const express = require("express");

const {
  createTripDay,
  getTripDays,
} = require("../controllers/tripDayController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, createTripDay);

router.get("/:tripId", authMiddleware, getTripDays);

module.exports = router;