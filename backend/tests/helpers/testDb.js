// The one and only Postgres pool used by tests. Deliberately separate
// from src/config/db.js's pool (even though it would resolve to the
// same connection right now) so this file's safety guard is the
// single choke point every test query goes through.
//
// Guard: refuses to even construct a pool unless DB_NAME is exactly
// "tripflow_test". This is what makes "tests accidentally point at
// tripflow_db" impossible rather than just unlikely -- a misconfigured
// .env.test (e.g. someone copy-pastes DB_NAME=tripflow_db into it)
// throws immediately, before a single query runs.
const { Pool } = require("pg");

const EXPECTED_TEST_DB_NAME = "tripflow_test";

if (process.env.DB_NAME !== EXPECTED_TEST_DB_NAME) {
  throw new Error(
    `Refusing to run tests: DB_NAME is "${process.env.DB_NAME}", expected exactly ` +
    `"${EXPECTED_TEST_DB_NAME}". Tests must never run against the development database. ` +
    `Load the test environment with --env-file=.env.test (see npm test / .env.test.example).`
  );
}

// src/config/db.js prefers DATABASE_URL over DB_*, so a DATABASE_URL in
// the test environment could silently point the app somewhere other
// than the DB_NAME checked above. Refuse outright.
if (process.env.DATABASE_URL) {
  throw new Error("Refusing to run tests: DATABASE_URL must not be set in the test environment.");
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
