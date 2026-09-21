const pool = require("../config/db");

const createTrip = async (req, res) => {
  try {
    const { title, destination, start_date, end_date } = req.body;

    if (!title || !destination || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "Title, destination, start_date ve end_date zorunludur.",
      });
    }

    const result = await pool.query(
      `INSERT INTO trips
       (user_id, title, destination, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        req.user.id,
        title,
        destination,
        start_date,
        end_date,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Gezi oluşturuldu.",
      trip: result.rows[0],
    });
  } catch (error) {
    console.error("Create trip error:", error);

    res.status(500).json({
      success: false,
      message: "Gezi oluşturulurken hata oluştu.",
    });
  }
};

const getTrips = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM trips
       WHERE user_id = $1
       ORDER BY start_date ASC`,
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      trips: result.rows,
    });
  } catch (error) {
    console.error("Get trips error:", error);

    res.status(500).json({
      success: false,
      message: "Geziler alınırken hata oluştu.",
    });
  }
};

module.exports = {
  createTrip,
  getTrips,
};