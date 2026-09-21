const express = require("express");
const cors = require("cors");
require("dotenv").config();

const healthRoutes = require("./routes/healthRoutes");
const userRoutes = require("./routes/userRoutes");
const tripRoutes = require("./routes/tripRoutes");
const tripDayRoutes = require("./routes/tripDayRoutes");
const activityRoutes = require("./routes/activityRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/trip-days", tripDayRoutes);
app.use("/api/activities", activityRoutes);

app.listen(PORT, () => {
  console.log(`TripFlow API ${PORT} portunda çalışıyor.`);
});