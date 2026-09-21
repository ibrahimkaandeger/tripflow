const express = require("express");

const {
  createTrip,
  getTrips,
} = require("../controllers/tripController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, createTrip);

router.get("/", authMiddleware, getTrips);

module.exports = router;