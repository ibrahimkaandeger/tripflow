require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/config/db");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations() {
  const result = await pool.query("SELECT name FROM schema_migrations");
  return new Set(result.rows.map((row) => row.name));
}

async function applyMigration(client, name, sql) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (name) VALUES ($1)",
      [name]
    );
    await client.query("COMMIT");
    console.log(`Applied: ${name}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(`Migration ${name} failed and was rolled back: ${error.message}`);
  }
}

async function migrate() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log("No pending migrations. Database is up to date.");
    return;
  }

  const client = await pool.connect();
  try {
    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await applyMigration(client, file, sql);
    }
  } finally {
    client.release();
  }
}

migrate()
  .catch((error) => {
    console.error("Migration run failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
