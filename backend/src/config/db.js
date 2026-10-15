const { Pool } = require("pg");
require("dotenv").config();

// DATABASE_URL (e.g. from a hosting provider) takes precedence; the
// discrete DB_* variables remain the default for local development.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

module.exports = pool;
