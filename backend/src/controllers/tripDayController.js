const pool = require("../config/db");

const createTripDay = async (req, res) => {
  try {
    const { trip_id, day_number, date } = req.body;

    if (!trip_id || !day_number || !date) {
      return res.status(400).json({
        success: false,
        message: "trip_id, day_number ve date zorunludur.",
      });
    }

    const tripResult = await pool.query(
      `SELECT id
       FROM trips
       WHERE id = $1 AND user_id = $2`,
      [trip_id, req.user.id]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gezi bulunamadı.",
      });
    }

    const result = await pool.query(
      `INSERT INTO trip_days
       (trip_id, day_number, date)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [trip_id, day_number, date]
    );

    res.status(201).json({
      success: true,
      message: "Gezi günü oluşturuldu.",
      tripDay: result.rows[0],
    });
  } catch (error) {
    console.error("Create trip day error:", error);

    res.status(500).json({
      success: false,
      message: "Gezi günü oluşturulurken hata oluştu.",
    });
  }
};

const getTripDays = async (req, res) => {
  try {
    const { tripId } = req.params;

    const tripResult = await pool.query(
      `SELECT id
       FROM trips
       WHERE id = $1 AND user_id = $2`,
      [tripId, req.user.id]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gezi bulunamadı.",
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM trip_days
       WHERE trip_id = $1
       ORDER BY day_number ASC`,
      [tripId]
    );

    res.status(200).json({
      success: true,
      tripDays: result.rows,
    });
  } catch (error) {
    console.error("Get trip days error:", error);

    res.status(500).json({
      success: false,
      message: "Gezi günleri alınırken hata oluştu.",
    });
  }
};

module.exports = {
  createTripDay,
  getTripDays,
};