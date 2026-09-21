const pool = require("../config/db");

const createActivity = async (req, res) => {
  try {
    const {
      trip_day_id,
      title,
      description,
      location,
      start_time,
      end_time,
    } = req.body;

    if (!trip_day_id || !title) {
      return res.status(400).json({
        success: false,
        message: "trip_day_id ve title zorunludur.",
      });
    }

    const dayResult = await pool.query(
      `SELECT td.id
       FROM trip_days td
       INNER JOIN trips t ON td.trip_id = t.id
       WHERE td.id = $1 AND t.user_id = $2`,
      [trip_day_id, req.user.id]
    );

    if (dayResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gezi günü bulunamadı.",
      });
    }

    const result = await pool.query(
      `INSERT INTO activities
       (trip_day_id, title, description, location, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        trip_day_id,
        title,
        description || null,
        location || null,
        start_time || null,
        end_time || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Aktivite oluşturuldu.",
      activity: result.rows[0],
    });
  } catch (error) {
    console.error("Create activity error:", error);

    res.status(500).json({
      success: false,
      message: "Aktivite oluşturulurken hata oluştu.",
    });
  }
};

const getActivities = async (req, res) => {
  try {
    const { tripDayId } = req.params;

    const dayResult = await pool.query(
      `SELECT td.id
       FROM trip_days td
       INNER JOIN trips t ON td.trip_id = t.id
       WHERE td.id = $1 AND t.user_id = $2`,
      [tripDayId, req.user.id]
    );

    if (dayResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gezi günü bulunamadı.",
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM activities
       WHERE trip_day_id = $1
       ORDER BY start_time ASC NULLS LAST`,
      [tripDayId]
    );

    res.status(200).json({
      success: true,
      activities: result.rows,
    });
  } catch (error) {
    console.error("Get activities error:", error);

    res.status(500).json({
      success: false,
      message: "Aktiviteler alınırken hata oluştu.",
    });
  }
};

module.exports = {
  createActivity,
  getActivities,
};