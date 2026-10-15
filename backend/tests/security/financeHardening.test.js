// Regression suite for the Finance backend hardening pass:
//   1. financial tour_participants fields need finance.update to write
//   2. ...and finance.read to be returned at all
//   3. finance list query filters are validated (400, never a 500)
//   4. malformed numeric ids are a 400, missing-but-valid ids a 404
//   5. finance lists sort deterministically (transaction_date, id)
// plus a regression pass over the existing finance/participant reads.
//
// require order matters: testDb's DB_NAME guard must run before
// testServer requires src/app.js.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

require("../helpers/testDb");
const { startTestServer } = require("../helpers/testServer");
const { apiRequest } = require("../helpers/api");
const {
  registerUser,
  getGlobalRoleIds,
  createCompany,
  addCompanyUser,
  createTour,
  createParticipant,
  addTourParticipant,
  createFixtureTracker,
} = require("../helpers/fixtures");
const pool = require("../helpers/testDb");

const FINANCIAL_FIELDS = ["sale_price", "sale_currency", "payment_status"];
const INVALID_IDS = ["1.5", "abc", "-1", "999999999999999999999999"];

describe("Finance backend hardening", () => {
  let server;
  let baseUrl;
  let companyId;
  let tourId;
  let registeredParticipantId;
  let unregisteredParticipantId;
  let owner;
  let manager;
  let staff;
  let limited;
  let selfUser;
  const transactionIds = [];
  const fixtures = createFixtureTracker();

  function api(method, path, opts) {
    return apiRequest(baseUrl, method, path, opts);
  }

  function as(user) {
    return { token: user.token, companyId };
  }

  async function assignment() {
    const result = await pool.query(
      "SELECT room_number, sale_price, sale_currency, payment_status FROM tour_participants WHERE tour_id = $1 AND participant_id = $2",
      [tourId, registeredParticipantId]
    );
    return result.rows[0];
  }

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
    const roleId = await getGlobalRoleIds();

    companyId = fixtures.trackCompany(await createCompany("Finance Hardening Test Co"));
    owner = fixtures.trackUser(await registerUser(baseUrl, "fin_owner"));
    manager = fixtures.trackUser(await registerUser(baseUrl, "fin_manager"));
    staff = fixtures.trackUser(await registerUser(baseUrl, "fin_staff"));
    limited = fixtures.trackUser(await registerUser(baseUrl, "fin_limited"));
    selfUser = fixtures.trackUser(await registerUser(baseUrl, "fin_self"));

    await addCompanyUser(companyId, owner.id, roleId.OWNER);
    await addCompanyUser(companyId, manager.id, roleId.MANAGER);
    await addCompanyUser(companyId, staff.id, roleId.STAFF);

    // Custom role: participants.read + participants.update, but no
    // finance.* at all -- the exact case that used to leak sale_price.
    const roleRes = await api("POST", "/roles", { ...as(owner), body: { name: "Participants Only" } });
    assert.equal(roleRes.status, 201);
    const perms = await pool.query(
      "SELECT id FROM permissions WHERE key IN ('participants.read', 'participants.update')"
    );
    const permRes = await api("PUT", `/roles/${roleRes.body.data.id}/permissions`, {
      ...as(owner),
      body: { permissionIds: perms.rows.map((row) => row.id) },
    });
    assert.equal(permRes.status, 200);
    await addCompanyUser(companyId, limited.id, roleRes.body.data.id);

    tourId = await createTour(companyId, owner.id);
    registeredParticipantId = await createParticipant(companyId, selfUser.id);
    unregisteredParticipantId = await createParticipant(companyId, null);
    await addTourParticipant(tourId, registeredParticipantId);
    await pool.query(
      "UPDATE tour_participants SET sale_price = 1000, sale_currency = 'EUR' WHERE tour_id = $1 AND participant_id = $2",
      [tourId, registeredParticipantId]
    );

    // Two transactions on the same date (sort tie) + one linked to the
    // participant for the /me payments regression check.
    for (const body of [
      { type: "INCOME", category: "TOUR_SALE", amount: 100, currency: "TRY", transaction_date: "2026-10-01" },
      { type: "EXPENSE", category: "HOTEL", amount: 50, currency: "TRY", transaction_date: "2026-10-01" },
      {
        type: "INCOME", category: "PARTICIPANT_PAYMENT", amount: 300, currency: "EUR",
        transaction_date: "2026-09-15", participant_id: registeredParticipantId,
      },
    ]) {
      const res = await api("POST", `/tours/${tourId}/finance`, { ...as(owner), body });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      transactionIds.push(res.body.data.id);
    }
  });

  after(async () => {
    await fixtures.cleanup();
    await server.close();
  });

  describe("1. participant financial field authorization", () => {
    const path = () => `/tours/${tourId}/participants/${registeredParticipantId}`;

    it("STAFF can still update non-financial fields (200)", async () => {
      const res = await api("PATCH", path(), { ...as(staff), body: { room_number: "101" } });
      assert.equal(res.status, 200);
      assert.equal((await assignment()).room_number, "101");
    });

    for (const field of FINANCIAL_FIELDS) {
      it(`STAFF cannot change ${field} (403)`, async () => {
        const value = { sale_price: 1, sale_currency: "USD", payment_status: "PAID" }[field];
        const res = await api("PATCH", path(), { ...as(staff), body: { [field]: value } });
        assert.equal(res.status, 403);
        assert.equal(res.body.error.code, "PERMISSION_DENIED");
      });
    }

    it("STAFF mixed body is rejected as a whole (nothing applied)", async () => {
      const res = await api("PATCH", path(), {
        ...as(staff),
        body: { room_number: "999", payment_status: "PAID" },
      });
      assert.equal(res.status, 403);
      const row = await assignment();
      assert.equal(row.room_number, "101");
      assert.equal(row.payment_status, "UNPAID");
    });

    it("STAFF cannot set a price when adding a participant; can add without one", async () => {
      const denied = await api("POST", `/tours/${tourId}/participants`, {
        ...as(staff),
        body: { participant_id: unregisteredParticipantId, sale_price: 500, sale_currency: "TRY" },
      });
      assert.equal(denied.status, 403);

      const allowed = await api("POST", `/tours/${tourId}/participants`, {
        ...as(staff),
        body: { participant_id: unregisteredParticipantId },
      });
      assert.equal(allowed.status, 201);
    });

    it("custom role without finance.update cannot change financial fields", async () => {
      const res = await api("PATCH", path(), { ...as(limited), body: { sale_price: 2 } });
      assert.equal(res.status, 403);
    });

    it("MANAGER (finance.update) can change financial fields", async () => {
      const res = await api("PATCH", path(), {
        ...as(manager),
        body: { sale_price: 1200, sale_currency: "EUR", payment_status: "PARTIALLY_PAID" },
      });
      assert.equal(res.status, 200);
      const row = await assignment();
      assert.equal(Number(row.sale_price), 1200);
      assert.equal(row.payment_status, "PARTIALLY_PAID");
    });
  });

  describe("2. participant response financial field filtering", () => {
    it("finance.read holders (OWNER, STAFF) get the financial fields", async () => {
      for (const user of [owner, staff]) {
        const res = await api("GET", `/tours/${tourId}/participants`, as(user));
        assert.equal(res.status, 200);
        const row = res.body.data.find((p) => p.participant_id === registeredParticipantId);
        for (const field of FINANCIAL_FIELDS) assert.ok(field in row, `${field} expected`);
      }
    });

    it("participants.read without finance.read: list omits financial fields", async () => {
      const res = await api("GET", `/tours/${tourId}/participants`, as(limited));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.length > 0);
      for (const row of res.body.data) {
        for (const field of FINANCIAL_FIELDS) assert.ok(!(field in row), `${field} leaked`);
        assert.ok("first_name" in row && "status" in row);
      }
    });

    it("participants.update without finance.read: write response omits financial fields", async () => {
      const res = await api("PATCH", `/tours/${tourId}/participants/${registeredParticipantId}`, {
        ...as(limited),
        body: { notes: "custom role edit" },
      });
      assert.equal(res.status, 200);
      for (const field of FINANCIAL_FIELDS) assert.ok(!(field in res.body.data), `${field} leaked`);
    });
  });

  describe("3. finance list query validation", () => {
    const badQueries = [
      "tour=abc", "tour=1.5", "participant=abc", "participant=-1",
      "dateFrom=notadate", "dateTo=notadate", "dateFrom=2026-02-30", "dateTo=2026-13-01",
      "type=NOPE", "category=NOPE", "status=NOPE", "currency=XYZ",
      "page=abc", "page=0", "limit=0", "limit=abc", "tour=1&tour=2",
    ];

    for (const query of badQueries) {
      it(`GET /finance/transactions?${query} → 400`, async () => {
        const res = await api("GET", `/finance/transactions?${query}`, as(owner));
        assert.equal(res.status, 400, JSON.stringify(res.body));
        assert.equal(res.body.error.code, "VALIDATION_ERROR");
      });
    }

    it("the same bad filters are rejected on /tours/:tourId/finance", async () => {
      for (const query of ["participant=abc", "dateFrom=notadate", "type=NOPE", "page=abc"]) {
        const res = await api("GET", `/tours/${tourId}/finance?${query}`, as(owner));
        assert.equal(res.status, 400, query);
      }
    });

    it("valid filters still work, limit is still clamped to 100", async () => {
      const res = await api(
        "GET",
        `/finance/transactions?tour=${tourId}&type=INCOME&status=PENDING&currency=TRY&dateFrom=2026-01-01&dateTo=2026-12-31&page=1&limit=500`,
        as(owner)
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.pagination.limit, 100);
      assert.equal(res.body.data.length, 1);
    });

    it("invalid participant_id on create → 400 (no row written)", async () => {
      const res = await api("POST", `/tours/${tourId}/finance`, {
        ...as(owner),
        body: { type: "INCOME", category: "TOUR_SALE", amount: 1, currency: "TRY", transaction_date: "2026-10-02", participant_id: "abc" },
      });
      assert.equal(res.status, 400);
    });
  });

  describe("4. numeric id validation", () => {
    for (const bad of INVALID_IDS) {
      it(`id "${bad}" → 400 on every finance-scoped route`, async () => {
        const paths = [
          ["GET", `/finance/transactions/${bad}`],
          ["PATCH", `/finance/transactions/${bad}`],
          ["PATCH", `/finance/transactions/${bad}/cancel`],
          ["GET", `/tours/${bad}/finance`],
          ["GET", `/tours/${bad}/participants`],
          ["PATCH", `/tours/${tourId}/participants/${bad}`],
          ["GET", `/me/tours/${bad}/payments`],
        ];
        for (const [method, path] of paths) {
          const user = path.startsWith("/me/") ? selfUser : owner;
          const res = await api(method, path, { ...as(user), body: method === "PATCH" ? { notes: "x" } : undefined });
          assert.equal(res.status, 400, `${method} ${path}: ${JSON.stringify(res.body)}`);
        }
      });
    }

    it("valid but non-existent ids stay 404", async () => {
      for (const path of ["/finance/transactions/999999", "/tours/999999/finance", "/tours/999999/participants"]) {
        const res = await api("GET", path, as(owner));
        assert.equal(res.status, 404, path);
      }
      const me = await api("GET", "/me/tours/999999/payments", { token: selfUser.token });
      assert.equal(me.status, 404);
    });

    it("authentication is still checked first (401 before 400)", async () => {
      const res = await api("GET", "/finance/transactions/1.5");
      assert.equal(res.status, 401);
    });
  });

  describe("5. finance sort stability", () => {
    it("same transaction_date is ordered by id DESC", async () => {
      const res = await api("GET", `/tours/${tourId}/finance`, as(owner));
      assert.equal(res.status, 200);
      const ids = res.body.data.map((row) => row.id);
      // transactionIds[0] and [1] share 2026-10-01; [2] is older.
      assert.deepEqual(ids, [transactionIds[1], transactionIds[0], transactionIds[2]]);
    });
  });

  describe("regression: existing read endpoints", () => {
    it("GET /finance/transactions", async () => {
      const res = await api("GET", "/finance/transactions", as(owner));
      assert.equal(res.status, 200);
      assert.equal(res.body.pagination.total, 3);
    });

    it("GET /finance/transactions/:id", async () => {
      const res = await api("GET", `/finance/transactions/${transactionIds[0]}`, as(owner));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, transactionIds[0]);
    });

    it("GET /tours/:tourId/finance with pagination", async () => {
      const res = await api("GET", `/tours/${tourId}/finance?page=1&limit=2`, as(owner));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      assert.deepEqual(res.body.pagination, { page: 1, limit: 2, total: 3, totalPages: 2 });
    });

    it("GET /me/tours/:tourId/payments still returns the participant's own sale data", async () => {
      const res = await api("GET", `/me/tours/${tourId}/payments`, { token: selfUser.token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.sale.sale_currency, "EUR");
      assert.equal(res.body.data.transactions.length, 1);
    });

    it("no token / non-member are still rejected", async () => {
      assert.equal((await api("GET", `/tours/${tourId}/finance`)).status, 401);
      const outsider = fixtures.trackUser(await registerUser(baseUrl, "fin_outsider"));
      const res = await api("GET", `/tours/${tourId}/finance`, { token: outsider.token, companyId });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, "NOT_COMPANY_MEMBER");
    });
  });
});
