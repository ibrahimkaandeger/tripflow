// Permanent regression suite for the RBAC privilege-ceiling fix
// (see git log: "Harden RBAC privilege ceiling"). Every scenario here
// was manually verified once via a throwaway script at the time of
// the fix; this file is that verification made permanent so a future
// change can't silently reopen the escalation path.
//
// require order matters: testDb's DB_NAME guard must run before
// testServer requires src/app.js (which builds the app's own pool),
// so a misconfigured test environment fails loudly here first.
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
  getCompanyUserId,
  createFixtureTracker,
} = require("../helpers/fixtures");
const pool = require("../helpers/testDb");

describe("RBAC privilege ceiling", () => {
  let server;
  let baseUrl;
  let roleId;
  let companyAId;
  let companyBId;
  let owner;
  let admin;
  let targetUser;
  let ownerB;
  const fixtures = createFixtureTracker();

  function api(method, path, opts) {
    return apiRequest(baseUrl, method, path, opts);
  }

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;

    roleId = await getGlobalRoleIds();
    assert.ok(roleId.OWNER && roleId.ADMIN, "global OWNER/ADMIN roles must exist (migration 003)");

    companyAId = fixtures.trackCompany(await createCompany("RBAC Test Co A"));
    companyBId = fixtures.trackCompany(await createCompany("RBAC Test Co B"));

    owner = fixtures.trackUser(await registerUser(baseUrl, "rbac_owner"));
    admin = fixtures.trackUser(await registerUser(baseUrl, "rbac_admin"));
    targetUser = fixtures.trackUser(await registerUser(baseUrl, "rbac_target"));
    ownerB = fixtures.trackUser(await registerUser(baseUrl, "rbac_ownerB"));

    await addCompanyUser(companyAId, owner.id, roleId.OWNER);
    await addCompanyUser(companyAId, admin.id, roleId.ADMIN);
    await addCompanyUser(companyAId, targetUser.id, roleId.STAFF);
    await addCompanyUser(companyBId, ownerB.id, roleId.OWNER);
  });

  after(async () => {
    await fixtures.cleanup();
    await server.close();
  });

  it("1. actor cannot grant a permission their own role does not have", async () => {
    const roleRes = await api("POST", "/roles", {
      token: admin.token,
      companyId: companyAId,
      body: { name: "Escalation Attempt Role" },
    });
    assert.equal(roleRes.status, 201);
    const customRoleId = roleRes.body.data.id;

    const companyDelete = await pool.query("SELECT id FROM permissions WHERE key = 'company.delete'");

    const res = await api("PUT", `/roles/${customRoleId}/permissions`, {
      token: admin.token,
      companyId: companyAId,
      body: { permissionIds: [companyDelete.rows[0].id] },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "PRIVILEGE_CEILING_EXCEEDED");
  });

  it("2. actor cannot assign themselves a more powerful role", async () => {
    const adminCompanyUserId = await getCompanyUserId(companyAId, admin.id);

    const res = await api("PATCH", `/company-users/${adminCompanyUserId}`, {
      token: admin.token,
      companyId: companyAId,
      body: { role_id: roleId.OWNER },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "PRIVILEGE_CEILING_EXCEEDED");
  });

  it("3. actor cannot assign another user a more powerful role", async () => {
    const targetCompanyUserId = await getCompanyUserId(companyAId, targetUser.id);

    const res = await api("PATCH", `/company-users/${targetCompanyUserId}`, {
      token: admin.token,
      companyId: companyAId,
      body: { role_id: roleId.OWNER },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "PRIVILEGE_CEILING_EXCEEDED");
  });

  it("4. actor cannot assign a pre-existing more powerful role to themselves", async () => {
    // OWNER legitimately creates a role holding a permission ADMIN
    // lacks, without ever assigning it to anyone yet.
    const superRoleRes = await api("POST", "/roles", {
      token: owner.token,
      companyId: companyAId,
      body: { name: "Pre-existing Super Role" },
    });
    const superRoleId = superRoleRes.body.data.id;
    const companyDelete = await pool.query("SELECT id FROM permissions WHERE key = 'company.delete'");
    await api("PUT", `/roles/${superRoleId}/permissions`, {
      token: owner.token,
      companyId: companyAId,
      body: { permissionIds: [companyDelete.rows[0].id] },
    });

    // ADMIN never touches setRolePermissions here -- just tries to
    // assign the already-privileged role directly.
    const adminCompanyUserId = await getCompanyUserId(companyAId, admin.id);
    const res = await api("PATCH", `/company-users/${adminCompanyUserId}`, {
      token: admin.token,
      companyId: companyAId,
      body: { role_id: superRoleId },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "PRIVILEGE_CEILING_EXCEEDED");
  });

  it("5. a role from Company A cannot be assigned within Company B", async () => {
    const roleFromA = await api("POST", "/roles", {
      token: owner.token,
      companyId: companyAId,
      body: { name: "Company A Only Role" },
    });

    const ownerBCompanyUserId = await getCompanyUserId(companyBId, ownerB.id);
    const res = await api("PATCH", `/company-users/${ownerBCompanyUserId}`, {
      token: ownerB.token,
      companyId: companyBId,
      body: { role_id: roleFromA.body.data.id },
    });

    assert.equal(res.status, 400);
  });

  it("6. OWNER can assign a role requiring full privileges (e.g. OWNER) when appropriate", async () => {
    const targetCompanyUserId = await getCompanyUserId(companyAId, targetUser.id);

    const res = await api("PATCH", `/company-users/${targetCompanyUserId}`, {
      token: owner.token,
      companyId: companyAId,
      body: { role_id: roleId.OWNER },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.role_id, roleId.OWNER);

    // revert so later tests see the expected STAFF baseline
    await pool.query("UPDATE company_users SET role_id = $1 WHERE id = $2", [
      roleId.STAFF,
      targetCompanyUserId,
    ]);
  });

  it("7. actor can grant a permission they themselves hold", async () => {
    const roleRes = await api("POST", "/roles", {
      token: admin.token,
      companyId: companyAId,
      body: { name: "Legit Grant Role" },
    });
    const customRoleId = roleRes.body.data.id;

    const toursRead = await pool.query("SELECT id FROM permissions WHERE key = 'tours.read'");

    const res = await api("PUT", `/roles/${customRoleId}/permissions`, {
      token: admin.token,
      companyId: companyAId,
      body: { permissionIds: [toursRead.rows[0].id] },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].key, "tours.read");
  });

  it("8. status-only company_users update does not trigger the role ceiling check", async () => {
    const targetCompanyUserId = await getCompanyUserId(companyAId, targetUser.id);

    // Read whatever role_id is currently set rather than assuming a
    // fixed value, so this test doesn't depend on another test having
    // run first and left a particular role in place.
    const before = await pool.query(
      "SELECT role_id, status FROM company_users WHERE id = $1",
      [targetCompanyUserId]
    );
    const roleIdBefore = before.rows[0].role_id;

    const res = await api("PATCH", `/company-users/${targetCompanyUserId}`, {
      token: admin.token,
      companyId: companyAId,
      body: { status: "INACTIVE" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "INACTIVE");
    // role_id must be untouched -- proves assertActorCanGrantRole
    // (companyUserService.js) is only invoked when role_id is
    // actually present in the request body.
    assert.equal(res.body.data.role_id, roleIdBefore);

    // revert so the fixture is left in its expected baseline state
    await pool.query("UPDATE company_users SET status = 'ACTIVE' WHERE id = $1", [
      targetCompanyUserId,
    ]);
  });
});
