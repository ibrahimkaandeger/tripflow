const pool = require("../config/db");

const healthCheck = async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.status(200).json({
      success: true,
      message: "TripFlow API çalışıyor.",
      database: "connected",
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database bağlantısı başarısız.",
    });
  }
};

module.exports = {
  healthCheck,
};