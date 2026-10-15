const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const { signUserToken } = require("../utils/token");
const { EMAIL_REGEX } = require("../utils/validate");
const { createCompanyWithOwner } = require("../services/companyService");

const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password; longer input would
// be silently truncated, so it is rejected instead.
const MAX_PASSWORD_LENGTH = 72;
const MAX_NAME_LENGTH = 100;
const MAX_COMPANY_NAME_LENGTH = 200;

// Emails are compared case-insensitively and stored trimmed/lowercased,
// so "Ali@Example.com" and "ali@example.com" are the same account.
function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

const createUser = async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  const companyName = typeof req.body.companyName === "string" ? req.body.companyName.trim() : "";

  if (!name || !email || !password) {
    return badRequest(res, "Name, email ve password zorunludur.");
  }
  if (name.length > MAX_NAME_LENGTH) {
    return badRequest(res, `Name en fazla ${MAX_NAME_LENGTH} karakter olabilir.`);
  }
  if (!EMAIL_REGEX.test(email) || email.length > 255) {
    return badRequest(res, "Geçerli bir email adresi girin.");
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return badRequest(res, `Password en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return badRequest(res, `Password en fazla ${MAX_PASSWORD_LENGTH} karakter olabilir.`);
  }
  if (companyName.length > MAX_COMPANY_NAME_LENGTH) {
    return badRequest(res, `Şirket adı en fazla ${MAX_COMPANY_NAME_LENGTH} karakter olabilir.`);
  }

  const client = await pool.connect();

  try {
    const existingUser = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Bu email adresi zaten kayıtlı.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // User + (optional) company + OWNER membership are created together
    // or not at all, so a failed company insert never leaves an
    // orphaned, company-less account behind.
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );
    const user = result.rows[0];

    let company = null;
    if (companyName) {
      company = await createCompanyWithOwner(client, user.id, { name: companyName });
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Kayıt başarılı.",
      token: signUserToken(user),
      user,
      company,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    // Two concurrent registrations can both pass the SELECT above; the
    // users_email_key unique constraint is the real guarantee.
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Bu email adresi zaten kayıtlı.",
      });
    }

    console.error("Create user error:", error.message);

    res.status(500).json({
      success: false,
      message: "Kayıt olurken beklenmeyen bir hata oluştu.",
    });
  } finally {
    client.release();
  }
};

const loginUser = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password || typeof password !== "string") {
      return badRequest(res, "Email ve password zorunludur.");
    }

    const result = await pool.query(
      "SELECT id, name, email, password FROM users WHERE LOWER(email) = $1",
      [email]
    );

    // Same message for unknown email and wrong password, so the
    // response doesn't reveal which accounts exist.
    const user = result.rows[0];
    const isPasswordCorrect = user ? await bcrypt.compare(password, user.password) : false;

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Email veya şifre hatalı.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Giriş başarılı.",
      token: signUserToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      success: false,
      message: "Giriş yapılırken beklenmeyen bir hata oluştu.",
    });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı.",
      });
    }

    // Which companies this account belongs to (and as what), so the
    // client can route a company-less user to onboarding.
    const memberships = await pool.query(
      `SELECT cu.company_id, c.name AS company_name, r.name AS role_name, cu.status
       FROM company_users cu
       JOIN companies c ON c.id = cu.company_id
       JOIN roles r ON r.id = cu.role_id
       WHERE cu.user_id = $1
       ORDER BY cu.created_at`,
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      user: result.rows[0],
      memberships: memberships.rows,
    });
  } catch (error) {
    console.error("Get me error:", error.message);

    res.status(500).json({
      success: false,
      message: "Kullanıcı bilgileri alınamadı.",
    });
  }
};

module.exports = {
  createUser,
  loginUser,
  getMe,
};
