const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Yetkilendirme token'ı bulunamadı.",
    });
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Geçersiz veya süresi dolmuş token.",
    });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Kullanıcı bulunamadı.",
      });
    }

    req.user = result.rows[0];

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Kimlik doğrulama sırasında beklenmeyen bir hata oluştu.",
    });
  }
};

module.exports = authMiddleware;
