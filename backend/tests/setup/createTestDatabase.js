// One-time (or occasional) setup: creates the tripflow_test database
// if it doesn't already exist. Run manually via `npm run test:db:create`
// -- never auto-chained into `npm test`, since creating a database is
// a more consequential operation than the idempotent schema migration
// that IS auto-chained (see package.json "pretest").
//
// Safety: connects to Postgres's own "postgres" maintenance database
// (never tripflow_db, never tripflow_test itself, since you can't
// CREATE DATABASE while connected to it) using the same host/port/
// user/password as .env.test. The target name is never taken from a
// freely-editable env var and interpolated -- it's a literal,
// hardcoded "tripflow_test", so this script can never be pointed at
// dropping/creating anything else, including the dev database.
const { Client } = require("pg");

const TARGET_DB_NAME = "tripflow_test";

async function main() {
  if (process.env.DB_NAME !== TARGET_DB_NAME) {
    throw new Error(
      `Refusing to run: DB_NAME is "${process.env.DB_NAME}", expected "${TARGET_DB_NAME}". ` +
      `Run this with the test environment loaded (npm run test:db:create).`
    );
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: "postgres",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await client.connect();

  try {
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [TARGET_DB_NAME]
    );

    if (existing.rows.length > 0) {
      console.log(`Database "${TARGET_DB_NAME}" already exists. Nothing to do.`);
      return;
    }

    // CREATE DATABASE cannot be parameterized; TARGET_DB_NAME is the
    // literal constant above, never user/env-supplied input.
    await client.query(`CREATE DATABASE "${TARGET_DB_NAME}"`);
    console.log(`Created database "${TARGET_DB_NAME}".`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to create test database:", error.message);
  process.exitCode = 1;
});
