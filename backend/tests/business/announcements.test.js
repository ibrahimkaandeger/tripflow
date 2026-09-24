// Permanent regression suite for announcement status transitions and
// read-access scoping (see git log: "Harden announcement access and
// status transitions"). Only endpoints that actually exist are used:
// there is no single-announcement GET for participants, so "can a
// participant read this announcement" is tested through
// POST /announcements/:id/read (markAnnouncementRead), which is the
// real function carrying the PUBLISHED-only / DRAFT+ARCHIVED-404
// guard this suite exists to protect.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

require("../helpers/testDb");
const { startTestServer } = require("../helpers/testServer");
const { apiRequest } = require("../helpers/api");
const {
  registerUser,
  createCompany,
  addCompanyUser,
  getGlobalRoleIds,
  createTour,
  createParticipant,
  addTourParticipant,
  createFixtureTracker,
} = require("../helpers/fixtures");
const pool = require("../helpers/testDb");

describe("Announcement access and status transitions", () => {
  let server;
  let baseUrl;
  let roleId;
  let companyAId;
  let companyBId;
  let ownerA;
  let ownerB;
  let participantUser;
  let tourAId;
  let tourBId;
  const fixtures = createFixtureTracker();

  function api(method, path, opts) {
    return apiRequest(baseUrl, method, path, opts);
  }

  async function createAnnouncement(tourId, token, companyId, body = {}) {
    const res = await api("POST", `/tours/${tourId}/announcements`, {
      token,
      companyId,
      body: { title: "Test Announcement", content: "Content", ...body },
    });
    assert.equal(res.status, 201, `expected create to succeed: ${JSON.stringify(res.body)}`);
    return res.body.data;
  }

  function publish(id, token, companyId) {
    return api("PATCH", `/announcements/${id}/publish`, { token, companyId });
  }

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
    roleId = await getGlobalRoleIds();

    companyAId = fixtures.trackCompany(await createCompany("Announcement Test Co A"));
    companyBId = fixtures.trackCompany(await createCompany("Announcement Test Co B"));

    ownerA = fixtures.trackUser(await registerUser(baseUrl, "ann_ownerA"));
    ownerB = fixtures.trackUser(await registerUser(baseUrl, "ann_ownerB"));
    participantUser = fixtures.trackUser(await registerUser(baseUrl, "ann_participant"));

    await addCompanyUser(companyAId, ownerA.id, roleId.OWNER);
    await addCompanyUser(companyBId, ownerB.id, roleId.OWNER);

    tourAId = await createTour(companyAId, ownerA.id);
    tourBId = await createTour(companyBId, ownerB.id);

    // participantUser is only registered on tour A, never tour B --
    // that's what makes tests 7/9 meaningful.
    const participantAId = await createParticipant(companyAId, participantUser.id);
    await addTourParticipant(tourAId, participantAId);
  });

  after(async () => {
    await fixtures.cleanup();
    await server.close();
  });

  it("1. a PUBLISHED announcement cannot be re-set to PUBLISHED via normal PATCH", async () => {
    const ann = await createAnnouncement(tourAId, ownerA.token, companyAId);
    const pub = await publish(ann.id, ownerA.token, companyAId);
    assert.equal(pub.status, 200);

    const res = await api("PATCH", `/announcements/${ann.id}`, {
      token: ownerA.token,
      companyId: companyAId,
      body: { status: "PUBLISHED" },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  it("2. an ARCHIVED announcement cannot be published", async () => {
    const ann = await createAnnouncement(tourAId, ownerA.token, companyAId);
    const archiveRes = await api("PATCH", `/announcements/${ann.id}`, {
      token: ownerA.token,
      companyId: companyAId,
      body: { status: "ARCHIVED" },
    });
    assert.equal(archiveRes.status, 200);

    const res = await publish(ann.id, ownerA.token, companyAId);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "ANNOUNCEMENT_ARCHIVED");
  });

  it("3. a DRAFT announcement can be published", async () => {
    const ann = await createAnnouncement(tourAId, ownerA.token, companyAId);

    const res = await publish(ann.id, ownerA.token, companyAId);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "PUBLISHED");
    assert.notEqual(res.body.data.published_at, null);
  });

  it("4. publishing an already-PUBLISHED announcement is idempotent", async () => {
    const ann = await createAnnouncement(tourAId, ownerA.token, companyAId);
    const first = await publish(ann.id, ownerA.token, companyAId);
    assert.equal(first.status, 200);

    const second = await publish(ann.id, ownerA.token, companyAId);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.status, "PUBLISHED");
  });

  it("5. participant cannot read a DRAFT (unpublished) announcement", async () => {
    const ann = await createAnnouncement(tourAId, ownerA.token, companyAId);
    // stays DRAFT -- never published

    const res = await api("POST", `/announcements/${ann.id}/read`, {
      token: participantUser.token,
    });

    assert.equal(res.status, 404);
  });

  it("6. participant can read a PUBLISHED announcement on their own tour", async () => {
    const ann = await createAnnouncement(tourAId, ownerA.token, companyAId);
    await publish(ann.id, ownerA.token, companyAId);

    const res = await api("POST", `/announcements/${ann.id}/read`, {
      token: participantUser.token,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.readAs, "participant");
  });

  it("7. participant cannot read an announcement on a tour they are not registered on", async () => {
    const ann = await createAnnouncement(tourBId, ownerB.token, companyBId);
    await publish(ann.id, ownerB.token, companyBId);

    const res = await api("POST", `/announcements/${ann.id}/read`, {
      token: participantUser.token,
    });

    assert.equal(res.status, 404);
  });

  it("8. read is idempotent and the announcement drops off the unread list", async () => {
    const ann = await createAnnouncement(tourAId, ownerA.token, companyAId);
    await publish(ann.id, ownerA.token, companyAId);

    const first = await api("POST", `/announcements/${ann.id}/read`, {
      token: participantUser.token,
    });
    assert.equal(first.status, 200);

    const second = await api("POST", `/announcements/${ann.id}/read`, {
      token: participantUser.token,
    });
    assert.equal(second.status, 200);

    const unread = await api("GET", "/announcements/unread", { token: participantUser.token });
    assert.equal(unread.status, 200);
    assert.ok(
      !unread.body.data.some((a) => a.id === ann.id),
      "a read announcement must not appear in the unread list"
    );
  });

  it("9. Company A staff cannot read a Company B announcement", async () => {
    const ann = await createAnnouncement(tourBId, ownerB.token, companyBId);
    await publish(ann.id, ownerB.token, companyBId);

    const res = await api("GET", `/announcements/${ann.id}`, {
      token: ownerA.token,
      companyId: companyAId,
    });

    assert.equal(res.status, 404);
  });

  it("10. unread list returns only unread PUBLISHED announcements, never read or DRAFT ones", async () => {
    const readAnn = await createAnnouncement(tourAId, ownerA.token, companyAId, { title: "Already read" });
    await publish(readAnn.id, ownerA.token, companyAId);
    await api("POST", `/announcements/${readAnn.id}/read`, { token: participantUser.token });

    const unreadAnn = await createAnnouncement(tourAId, ownerA.token, companyAId, { title: "Still unread" });
    await publish(unreadAnn.id, ownerA.token, companyAId);

    const draftAnn = await createAnnouncement(tourAId, ownerA.token, companyAId, { title: "Still draft" });
    // never published

    const res = await api("GET", "/announcements/unread", { token: participantUser.token });
    assert.equal(res.status, 200);

    const ids = res.body.data.map((a) => a.id);
    assert.ok(ids.includes(unreadAnn.id), "unread PUBLISHED announcement must be present");
    assert.ok(!ids.includes(readAnn.id), "already-read announcement must not be present");
    assert.ok(!ids.includes(draftAnn.id), "DRAFT announcement must not be present");
  });
});
