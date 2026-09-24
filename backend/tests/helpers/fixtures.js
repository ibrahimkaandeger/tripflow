const pool = require("./testDb");
const { apiRequest } = require("./api");

const TEST_PASSWORD = "testpass123";
let emailCounter = 0;

// Unique per run so parallel/repeated runs never collide on the
// users.email unique constraint.
function uniqueEmail(label) {
  emailCounter += 1;
  return `test_${label}_${Date.now()}_${emailCounter}@example.com`;
}

// Real registration through the real HTTP endpoint (POST /api/users/)
// -- real bcrypt hashing, real JWT issued by the real login flow this
// mirrors. Nothing about auth is faked for the sake of a security
// test.
async function registerUser(baseUrl, label) {
  const email = uniqueEmail(label);
  const res = await apiRequest(baseUrl, "POST", "/users/", {
    body: { name: email, email, password: TEST_PASSWORD },
  });

  if (res.status !== 201) {
    throw new Error(`Fixture registerUser(${label}) failed: ${JSON.stringify(res.body)}`);
  }

  const id = res.body.data ? res.body.data.id : res.body.user.id;
  return { id, email, token: res.body.token };
}

async function getGlobalRoleIds() {
  const result = await pool.query("SELECT id, name FROM roles WHERE company_id IS NULL");
  const map = {};
  result.rows.forEach((row) => {
    map[row.name] = row.id;
  });
  return map;
}

async function createCompany(name) {
  const result = await pool.query(
    "INSERT INTO companies (name) VALUES ($1) RETURNING id",
    [name]
  );
  return result.rows[0].id;
}

async function addCompanyUser(companyId, userId, roleId, status = "ACTIVE") {
  const result = await pool.query(
    `INSERT INTO company_users (company_id, user_id, role_id, status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [companyId, userId, roleId, status]
  );
  return result.rows[0].id;
}

async function getCompanyUserId(companyId, userId) {
  const result = await pool.query(
    "SELECT id FROM company_users WHERE company_id = $1 AND user_id = $2",
    [companyId, userId]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

async function createTour(companyId, createdByUserId, overrides = {}) {
  const result = await pool.query(
    `INSERT INTO tours (company_id, title, destination, start_date, end_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      companyId,
      overrides.title || `Test Tour ${Date.now()}`,
      overrides.destination || "Test Destination",
      overrides.start_date || "2026-10-01",
      overrides.end_date || "2026-10-05",
      createdByUserId,
    ]
  );
  return result.rows[0].id;
}

// user_id is nullable by design (Phase 6): pass a registered user's
// id to let that account act as this participant via /api/me/...,
// or omit it for a staff-managed-only participant.
async function createParticipant(companyId, userId, overrides = {}) {
  const result = await pool.query(
    `INSERT INTO participants (company_id, user_id, first_name, last_name, email)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      companyId,
      userId || null,
      overrides.first_name || "Test",
      overrides.last_name || "Participant",
      overrides.email || uniqueEmail("participant"),
    ]
  );
  return result.rows[0].id;
}

async function addTourParticipant(tourId, participantId) {
  await pool.query(
    "INSERT INTO tour_participants (tour_id, participant_id) VALUES ($1, $2)",
    [tourId, participantId]
  );
}

// Tracks everything a test creates so it can be torn down in one call
// regardless of how the test exits. Companies cascade to most child
// tables on delete, except finance_transactions (RESTRICT, Phase
// Finance) which must be cleared first.
function createFixtureTracker() {
  const companyIds = [];
  const userIds = [];

  return {
    companyIds,
    userIds,
    trackCompany(id) {
      companyIds.push(id);
      return id;
    },
    trackUser(user) {
      userIds.push(user.id);
      return user;
    },
    async cleanup() {
      if (companyIds.length > 0) {
        await pool.query(
          "DELETE FROM finance_transactions WHERE company_id = ANY($1)",
          [companyIds]
        );
        await pool.query("DELETE FROM companies WHERE id = ANY($1)", [companyIds]);
      }
      if (userIds.length > 0) {
        await pool.query("DELETE FROM users WHERE id = ANY($1)", [userIds]);
      }
    },
  };
}

module.exports = {
  TEST_PASSWORD,
  registerUser,
  getGlobalRoleIds,
  createCompany,
  addCompanyUser,
  getCompanyUserId,
  createTour,
  createParticipant,
  addTourParticipant,
  createFixtureTracker,
};
