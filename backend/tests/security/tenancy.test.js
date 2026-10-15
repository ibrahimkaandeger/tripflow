// Company isolation and role enforcement across every resource type.
// Two companies each get a full operational data set; Company A's users
// then probe Company B's resources by id, through the company-wide
// lists, and via a forged X-Company-Id header. The VIEWER role is
// checked to be read-only and finance-blind, and team management is
// checked against privilege escalation.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

require("../helpers/testDb");
const { startTestServer } = require("../helpers/testServer");
const { apiRequest } = require("../helpers/api");
const {
  registerUser, getGlobalRoleIds, createCompany, addCompanyUser, getCompanyUserId, createFixtureTracker,
} = require("../helpers/fixtures");
const { createOperationalScenario } = require("../helpers/scenario");

describe("Company isolation and roles", () => {
  let server;
  let baseUrl;
  let roleId;
  let companyA;
  let companyB;
  let ownerA;
  let ownerB;
  let adminA;
  let viewerA;
  let staffA;
  let dataA;
  let dataB;
  const fixtures = createFixtureTracker();

  function api(method, path, opts) {
    return apiRequest(baseUrl, method, path, opts);
  }
  const as = (user, companyId) => ({ token: user.token, companyId });

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
    roleId = await getGlobalRoleIds();
    assert.ok(roleId.VIEWER, "VIEWER role must exist (migration 015)");

    companyA = fixtures.trackCompany(await createCompany("Tenancy Test A"));
    companyB = fixtures.trackCompany(await createCompany("Tenancy Test B"));
    ownerA = fixtures.trackUser(await registerUser(baseUrl, "ten_ownerA"));
    ownerB = fixtures.trackUser(await registerUser(baseUrl, "ten_ownerB"));
    adminA = fixtures.trackUser(await registerUser(baseUrl, "ten_adminA"));
    viewerA = fixtures.trackUser(await registerUser(baseUrl, "ten_viewerA"));
    staffA = fixtures.trackUser(await registerUser(baseUrl, "ten_staffA"));

    await addCompanyUser(companyA, ownerA.id, roleId.OWNER);
    await addCompanyUser(companyA, adminA.id, roleId.ADMIN);
    await addCompanyUser(companyA, viewerA.id, roleId.VIEWER);
    await addCompanyUser(companyA, staffA.id, roleId.STAFF);
    await addCompanyUser(companyB, ownerB.id, roleId.OWNER);

    dataA = await createOperationalScenario(baseUrl, ownerA, companyA, "Alpha");
    dataB = await createOperationalScenario(baseUrl, ownerB, companyB, "Beta");
  });

  after(async () => {
    await fixtures.cleanup();
    await server.close();
  });

  describe("Company A cannot reach Company B's resources", () => {
    const probes = () => [
      ["GET", `/tours/${dataB.tour.id}`],
      ["PATCH", `/tours/${dataB.tour.id}`, { title: "hijack" }],
      ["DELETE", `/tours/${dataB.tour.id}`],
      ["GET", `/participants/${dataB.participant.id}`],
      ["GET", `/participants/${dataB.participant.id}/tours`],
      ["PATCH", `/participants/${dataB.participant.id}`, { first_name: "hijack" }],
      ["DELETE", `/participants/${dataB.participant.id}`],
      ["GET", `/tours/${dataB.tour.id}/participants`],
      ["GET", `/flights/${dataB.flight.id}`],
      ["PATCH", `/flights/${dataB.flight.id}`, { airline: "hijack" }],
      ["DELETE", `/flights/${dataB.flight.id}`],
      ["GET", `/hotels/${dataB.hotel.id}`],
      ["PATCH", `/hotels/${dataB.hotel.id}`, { hotel_name: "hijack" }],
      ["GET", `/tours/${dataB.tour.id}/days`],
      ["GET", `/tour-days/${dataB.day.id}/activities`],
      ["PATCH", `/activities/${dataB.activity.id}`, { title: "hijack" }],
      ["DELETE", `/activities/${dataB.activity.id}`],
      ["GET", `/documents/${dataB.document.id}`],
      ["DELETE", `/documents/${dataB.document.id}`],
      ["GET", `/announcements/${dataB.announcement.id}`],
      ["PATCH", `/announcements/${dataB.announcement.id}/publish`],
      ["GET", `/finance/transactions/${dataB.payment.id}`],
      ["PATCH", `/finance/transactions/${dataB.payment.id}/cancel`],
      ["GET", `/tours/${dataB.tour.id}/finance`],
      ["GET", `/tours/${dataB.tour.id}/finance/summary`],
      ["POST", `/tours/${dataB.tour.id}/flights`, { airline: "X", flight_number: "1", departure_airport: "A", arrival_airport: "B", departure_datetime: "2026-11-01T09:00", arrival_datetime: "2026-11-01T10:00" }],
    ];

    it("every by-id access is a 404 (existence is not revealed)", async () => {
      for (const [method, path, body] of probes()) {
        const res = await api(method, path, { ...as(ownerA, companyA), body });
        assert.equal(res.status, 404, `${method} ${path} → ${res.status} ${JSON.stringify(res.body)}`);
      }
    });

    it("Company B's data is unchanged afterwards", async () => {
      const res = await api("GET", `/tours/${dataB.tour.id}`, as(ownerB, companyB));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.title, "Beta Tour");
      const flight = await api("GET", `/flights/${dataB.flight.id}`, as(ownerB, companyB));
      assert.equal(flight.body.data.airline, "Beta Air");
    });

    it("company-wide lists only ever contain the caller's own company", async () => {
      const lists = {
        "/tours": (row) => row.company_id,
        "/participants": (row) => row.company_id,
        "/finance/transactions": (row) => row.company_id,
      };
      for (const [path, companyOf] of Object.entries(lists)) {
        const res = await api("GET", path, as(ownerA, companyA));
        assert.equal(res.status, 200, path);
        assert.ok(res.body.data.length > 0, `${path} should list A's own data`);
        for (const row of res.body.data) assert.equal(companyOf(row), companyA, path);
      }

      const tourScoped = ["/flights", "/hotels", "/activities", "/documents", "/announcements"];
      for (const path of tourScoped) {
        const res = await api("GET", path, as(ownerA, companyA));
        assert.equal(res.status, 200, path);
        assert.ok(res.body.data.length > 0, `${path} should list A's own data`);
        for (const row of res.body.data) assert.equal(row.tour_id, dataA.tour.id, `${path} leaked another tour`);
      }
    });

    it("naming Company B in X-Company-Id is refused (403)", async () => {
      const res = await api("GET", "/tours", as(ownerA, companyB));
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, "NOT_COMPANY_MEMBER");
    });

    it("dashboard numbers are per company", async () => {
      const res = await api("GET", "/dashboard/summary", as(ownerA, companyA));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.customers.total, 1);
      assert.equal(res.body.data.tours.total, 1);
    });

    it("finance triggers refuse cross-company participant references", async () => {
      const res = await api("POST", `/tours/${dataA.tour.id}/finance`, {
        ...as(ownerA, companyA),
        body: { type: "INCOME", category: "PARTICIPANT_PAYMENT", amount: 5, currency: "EUR", transaction_date: "2026-10-02", participant_id: dataB.participant.id },
      });
      assert.equal(res.status, 422);
    });
  });

  describe("VIEWER role", () => {
    it("can read operations data", async () => {
      for (const path of ["/tours", "/participants", "/flights", "/hotels", "/activities", "/documents", "/announcements", `/tours/${dataA.tour.id}`, "/dashboard/summary"]) {
        const res = await api("GET", path, as(viewerA, companyA));
        assert.equal(res.status, 200, path);
      }
    });

    it("cannot create, update or delete anything (403)", async () => {
      const writes = [
        ["POST", "/tours", { title: "X", destination: "Y", start_date: "2026-12-01", end_date: "2026-12-02" }],
        ["PATCH", `/tours/${dataA.tour.id}`, { title: "X" }],
        ["DELETE", `/tours/${dataA.tour.id}`],
        ["POST", "/participants", { first_name: "X", last_name: "Y", email: "x@example.com" }],
        ["DELETE", `/participants/${dataA.participant.id}`],
        ["PATCH", `/flights/${dataA.flight.id}`, { airline: "X" }],
        ["DELETE", `/hotels/${dataA.hotel.id}`],
        ["POST", `/tours/${dataA.tour.id}/announcements`, { title: "X", content: "Y" }],
        ["POST", `/tours/${dataA.tour.id}/finance`, { type: "EXPENSE", category: "OTHER", amount: 1, currency: "TRY", transaction_date: "2026-10-01" }],
        ["PATCH", "/companies/me", { name: "X" }],
      ];
      for (const [method, path, body] of writes) {
        const res = await api(method, path, { ...as(viewerA, companyA), body });
        assert.equal(res.status, 403, `${method} ${path} → ${res.status}`);
      }
    });

    it("cannot see finance: 403 on finance routes, no finance block, no prices", async () => {
      assert.equal((await api("GET", "/finance/transactions", as(viewerA, companyA))).status, 403);
      assert.equal((await api("GET", "/finance/summary", as(viewerA, companyA))).status, 403);

      const dashboard = await api("GET", "/dashboard/summary", as(viewerA, companyA));
      assert.equal(dashboard.body.data.finance, null);

      const participants = await api("GET", `/tours/${dataA.tour.id}/participants`, as(viewerA, companyA));
      assert.equal(participants.status, 200);
      for (const row of participants.body.data) {
        assert.ok(!("sale_price" in row) && !("payment_status" in row));
      }
    });
  });

  describe("team management", () => {
    it("ADMIN cannot deactivate or re-role the OWNER (403)", async () => {
      const ownerMembership = await getCompanyUserId(companyA, ownerA.id);
      const res = await api("PATCH", `/company-users/${ownerMembership}`, { ...as(adminA, companyA), body: { status: "INACTIVE" } });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, "PRIVILEGE_CEILING_EXCEEDED");
    });

    it("nobody can change their own membership (400)", async () => {
      const own = await getCompanyUserId(companyA, ownerA.id);
      const res = await api("PATCH", `/company-users/${own}`, { ...as(ownerA, companyA), body: { status: "INACTIVE" } });
      assert.equal(res.status, 400);
    });

    it("OWNER can add an existing account by email and change its role", async () => {
      const newcomer = fixtures.trackUser(await registerUser(baseUrl, "ten_newcomer"));
      const added = await api("POST", "/company-users", {
        ...as(ownerA, companyA),
        body: { email: newcomer.email.toUpperCase(), role_id: roleId.VIEWER },
      });
      assert.equal(added.status, 201, JSON.stringify(added.body));

      const promoted = await api("PATCH", `/company-users/${added.body.data.id}`, { ...as(ownerA, companyA), body: { role_id: roleId.STAFF } });
      assert.equal(promoted.status, 200);

      const duplicate = await api("POST", "/company-users", { ...as(ownerA, companyA), body: { email: newcomer.email, role_id: roleId.VIEWER } });
      assert.equal(duplicate.status, 409);
    });

    it("unknown email and invalid status are rejected (400)", async () => {
      const unknown = await api("POST", "/company-users", { ...as(ownerA, companyA), body: { email: "nobody-here@example.com", role_id: roleId.VIEWER } });
      assert.equal(unknown.status, 400);
      const staffMembership = await getCompanyUserId(companyA, staffA.id);
      const badStatus = await api("PATCH", `/company-users/${staffMembership}`, { ...as(ownerA, companyA), body: { status: "BANNED" } });
      assert.equal(badStatus.status, 400);
    });

    it("STAFF (no users.update) cannot manage members", async () => {
      const viewerMembership = await getCompanyUserId(companyA, viewerA.id);
      const res = await api("PATCH", `/company-users/${viewerMembership}`, { ...as(staffA, companyA), body: { status: "INACTIVE" } });
      assert.equal(res.status, 403);
    });
  });
});
