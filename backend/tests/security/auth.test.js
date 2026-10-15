// Authentication, registration/onboarding and generic API hardening:
// validation, duplicate handling, credential errors, token checks,
// password never leaking, malformed JSON, CORS.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

require("../helpers/testDb");
const { startTestServer } = require("../helpers/testServer");
const { apiRequest } = require("../helpers/api");
const { TEST_PASSWORD, createFixtureTracker } = require("../helpers/fixtures");
const pool = require("../helpers/testDb");

let counter = 0;
function freshEmail(label) {
  counter += 1;
  return `test_auth_${label}_${Date.now()}_${counter}@example.com`;
}

function assertNoPassword(body) {
  assert.ok(!JSON.stringify(body).includes('"password"'), "response must never contain a password field");
}

describe("Authentication and onboarding", () => {
  let server;
  let baseUrl;
  const fixtures = createFixtureTracker();

  function api(method, path, opts) {
    return apiRequest(baseUrl, method, path, opts);
  }

  async function register(body) {
    const res = await api("POST", "/users/", { body });
    if (res.status === 201) {
      fixtures.trackUser(res.body.user);
      if (res.body.company) fixtures.trackCompany(res.body.company.id);
    }
    return res;
  }

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
  });

  after(async () => {
    await fixtures.cleanup();
    await server.close();
  });

  describe("register", () => {
    it("creates an account and returns a token, never the password", async () => {
      const email = freshEmail("ok");
      const res = await register({ name: "Ada Test", email, password: TEST_PASSWORD });
      assert.equal(res.status, 201);
      assert.ok(res.body.token);
      assert.equal(res.body.user.email, email);
      assert.equal(res.body.company, null);
      assertNoPassword(res.body);

      const stored = await pool.query("SELECT password FROM users WHERE id = $1", [res.body.user.id]);
      assert.notEqual(stored.rows[0].password, TEST_PASSWORD, "password must be stored hashed");
    });

    it("with companyName also creates the company and makes the user its OWNER", async () => {
      const res = await register({ name: "Owner Test", email: freshEmail("company"), password: TEST_PASSWORD, companyName: "Acme Travel Test" });
      assert.equal(res.status, 201);
      assert.equal(res.body.company.name, "Acme Travel Test");

      const me = await api("GET", "/users/me", { token: res.body.token });
      assert.equal(me.status, 200);
      assert.equal(me.body.memberships.length, 1);
      assert.equal(me.body.memberships[0].role_name, "OWNER");

      const perms = await api("GET", "/companies/me/permissions", { token: res.body.token });
      assert.equal(perms.status, 200);
      assert.equal(perms.body.data.role, "OWNER");
      assert.ok(perms.body.data.permissions.includes("finance.read"));
    });

    it("rejects a duplicate email, case-insensitively (409)", async () => {
      const email = freshEmail("dup");
      assert.equal((await register({ name: "A", email, password: TEST_PASSWORD })).status, 201);
      assert.equal((await register({ name: "B", email, password: TEST_PASSWORD })).status, 409);
      assert.equal((await register({ name: "C", email: email.toUpperCase(), password: TEST_PASSWORD })).status, 409);
    });

    it("stores emails normalized (trimmed, lowercase)", async () => {
      const email = freshEmail("norm");
      const res = await register({ name: "Norm", email: `  ${email.toUpperCase()}  `, password: TEST_PASSWORD });
      assert.equal(res.status, 201);
      assert.equal(res.body.user.email, email);
    });

    const invalid = [
      ["missing fields", { email: "x@example.com" }],
      ["invalid email", { name: "X", email: "not-an-email", password: TEST_PASSWORD }],
      ["short password", { name: "X", email: "short@example.com", password: "123" }],
      ["over-long password", { name: "X", email: "long@example.com", password: "a".repeat(73) }],
      ["over-long name", { name: "a".repeat(101), email: "name@example.com", password: TEST_PASSWORD }],
      ["non-string password", { name: "X", email: "type@example.com", password: 12345678 }],
    ];
    for (const [label, body] of invalid) {
      it(`rejects ${label} (400)`, async () => {
        assert.equal((await register(body)).status, 400);
      });
    }

    it("an invalid company name rejects the whole registration (no user left behind)", async () => {
      const email = freshEmail("rollback");
      const res = await register({ name: "R", email, password: TEST_PASSWORD, companyName: "a".repeat(201) });
      assert.equal(res.status, 400);
      const found = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
      assert.equal(found.rows.length, 0);
    });
  });

  describe("login", () => {
    let email;
    before(async () => {
      email = freshEmail("login");
      await register({ name: "Login Test", email, password: TEST_PASSWORD });
    });

    it("succeeds with correct credentials (any email casing)", async () => {
      const res = await api("POST", "/users/login", { body: { email: email.toUpperCase(), password: TEST_PASSWORD } });
      assert.equal(res.status, 200);
      assert.ok(res.body.token);
      assertNoPassword(res.body);
    });

    it("wrong password and unknown email get the same 401", async () => {
      const wrong = await api("POST", "/users/login", { body: { email, password: "wrong-password" } });
      const unknown = await api("POST", "/users/login", { body: { email: freshEmail("nobody"), password: TEST_PASSWORD } });
      assert.equal(wrong.status, 401);
      assert.equal(unknown.status, 401);
      assert.equal(wrong.body.message, unknown.body.message);
    });

    it("missing credentials → 400", async () => {
      assert.equal((await api("POST", "/users/login", { body: { email } })).status, 400);
    });
  });

  describe("tokens", () => {
    let user;
    before(async () => {
      const res = await register({ name: "Token Test", email: freshEmail("token"), password: TEST_PASSWORD });
      user = { ...res.body.user, token: res.body.token };
    });

    it("/users/me works with a valid token and never returns the password", async () => {
      const res = await api("GET", "/users/me", { token: user.token });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.id, user.id);
      assertNoPassword(res.body);
    });

    const badTokens = {
      "missing token": undefined,
      "garbage token": "not.a.jwt",
      "token signed with another secret": () => jwt.sign({ id: user.id }, "some-other-secret-value-that-is-long-enough"),
      "expired token": () => jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: -10 }),
      "token for a deleted user": () => jwt.sign({ id: 2147483000 }, process.env.JWT_SECRET),
    };
    for (const [label, token] of Object.entries(badTokens)) {
      it(`${label} → 401`, async () => {
        const value = typeof token === "function" ? token() : token;
        const res = await api("GET", "/users/me", { token: value });
        assert.equal(res.status, 401);
        const tours = await api("GET", "/tours", { token: value });
        assert.equal(tours.status, 401);
      });
    }
  });

  describe("onboarding (POST /companies)", () => {
    it("a user without a company can create one, exactly once", async () => {
      const reg = await register({ name: "Onboard", email: freshEmail("onboard"), password: TEST_PASSWORD });
      const token = reg.body.token;

      const before = await api("GET", "/tours", { token });
      assert.equal(before.status, 400);
      assert.equal(before.body.error.code, "COMPANY_CONTEXT_REQUIRED");

      assert.equal((await api("POST", "/companies", { token, body: { name: "  " } })).status, 400);

      const created = await api("POST", "/companies", { token, body: { name: "Onboarded Co" } });
      assert.equal(created.status, 201);
      fixtures.trackCompany(created.body.data.id);

      assert.equal((await api("GET", "/tours", { token })).status, 200);

      const again = await api("POST", "/companies", { token, body: { name: "Second Co" } });
      assert.equal(again.status, 409);
    });

    it("requires authentication", async () => {
      assert.equal((await api("POST", "/companies", { body: { name: "X" } })).status, 401);
    });
  });

  describe("API hardening", () => {
    it("malformed JSON is a 400, not a 500", async () => {
      const res = await fetch(`${baseUrl}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ not json",
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, "INVALID_JSON");
    });

    it("unknown routes return the JSON 404", async () => {
      const res = await api("GET", "/definitely-not-a-route");
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, "ROUTE_NOT_FOUND");
    });

    it("CORS only allows the configured client origin", async () => {
      const allowed = await fetch(`${baseUrl}/health`, { headers: { Origin: "http://localhost:5173" } });
      assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");

      const other = await fetch(`${baseUrl}/health`, { headers: { Origin: "https://evil.example.com" } });
      assert.equal(other.headers.get("access-control-allow-origin"), null);
    });

    it("does not advertise the framework", async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.equal(res.headers.get("x-powered-by"), null);
    });
  });
});
