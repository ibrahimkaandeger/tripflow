const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Legacy routes -- untouched, same mount points as before this phase.
const healthRoutes = require("./routes/healthRoutes");
const userRoutes = require("./routes/userRoutes");
const tripRoutes = require("./routes/tripRoutes");
const tripDayRoutes = require("./routes/tripDayRoutes");
const activityRoutes = require("./routes/activityRoutes");

// Business API routes (Phase: Business API). Each is mounted at
// "/api" and defines its own full relative paths internally (e.g.
// "/tours", "/tours/:tourId/flights") rather than being nested via
// Express's mergeParams, which keeps every route's full path visible
// in one place inside its own route file.
const companyRoutes = require("./routes/companyRoutes");
const companyUserRoutes = require("./routes/companyUserRoutes");
const roleRoutes = require("./routes/roleRoutes");
const tourRoutes = require("./routes/tourRoutes");
const participantRoutes = require("./routes/participantRoutes");
const tourParticipantRoutes = require("./routes/tourParticipantRoutes");
const tourDayRoutes = require("./routes/tourDayRoutes");
const businessActivityRoutes = require("./routes/businessActivityRoutes");
const flightRoutes = require("./routes/flightRoutes");
const hotelRoutes = require("./routes/hotelRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const documentRoutes = require("./routes/documentRoutes");
const financeRoutes = require("./routes/financeRoutes");
const participantSelfRoutes = require("./routes/participantSelfRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const notFoundHandler = require("./middleware/notFoundHandler");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Only the configured frontend origin(s) may call the API from a
// browser. CLIENT_URL accepts a comma-separated list; the Vite dev
// server is the default for local development.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    // Non-browser clients (curl, tests, server-to-server) send no Origin.
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));
app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/trip-days", tripDayRoutes);
app.use("/api/activities", activityRoutes);

app.use("/api", companyRoutes);
app.use("/api", companyUserRoutes);
app.use("/api", roleRoutes);
app.use("/api", tourRoutes);
app.use("/api", participantRoutes);
app.use("/api", tourParticipantRoutes);
app.use("/api", tourDayRoutes);
app.use("/api", businessActivityRoutes);
app.use("/api", flightRoutes);
app.use("/api", hotelRoutes);
app.use("/api", announcementRoutes);
app.use("/api", documentRoutes);
app.use("/api", financeRoutes);
app.use("/api", participantSelfRoutes);
app.use("/api", dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
