// End-to-end business flows through the real API: customers, tours and
// registrations, flights, hotels, days/activities, documents,
// announcements, finance (summaries + payment status) and the
// dashboard -- including the validation errors each one should give.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

require("../helpers/testDb");
const { startTestServer } = require("../helpers/testServer");
const { apiRequest } = require("../helpers/api");
const { registerUser, getGlobalRoleIds, createCompany, addCompanyUser, createFixtureTracker } = require("../helpers/fixtures");

describe("Business operations", () => {
  let server;
  let baseUrl;
  let companyId;
  let owner;
  const fixtures = createFixtureTracker();

  const call = (method, path, body) => apiRequest(baseUrl, method, path, { token: owner.token, companyId, body });
  async function expectStatus(method, path, body, status) {
    const res = await call(method, path, body);
    assert.equal(res.status, status, `${method} ${path} → ${res.status} ${JSON.stringify(res.body)}`);
    return res.body;
  }

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
    const roleId = await getGlobalRoleIds();
    companyId = fixtures.trackCompany(await createCompany("Operations Test Co"));
    owner = fixtures.trackUser(await registerUser(baseUrl, "ops_owner"));
    await addCompanyUser(companyId, owner.id, roleId.OWNER);
  });

  after(async () => {
    await fixtures.cleanup();
    await server.close();
  });

  describe("customers (participants)", () => {
    let customer;

    it("create / detail / update", async () => {
      customer = (await expectStatus("POST", "/participants", {
        first_name: "Zeynep", last_name: "Kaya", email: "zeynep.ops@example.com", phone: "+90 555 000 0000", birth_date: "1990-05-17",
      }, 201)).data;
      const detail = (await expectStatus("GET", `/participants/${customer.id}`, undefined, 200)).data;
      assert.equal(detail.first_name, "Zeynep");

      const updated = (await expectStatus("PATCH", `/participants/${customer.id}`, { city: "İzmir", phone: "" }, 200)).data;
      assert.equal(updated.city, "İzmir");
      assert.equal(updated.phone, null);
    });

    it("list supports search by full name, email and status filter", async () => {
      await expectStatus("POST", "/participants", { first_name: "Mehmet", last_name: "Demir", phone: "+90 555 111 1111" }, 201);
      const byName = (await expectStatus("GET", "/participants?search=zeynep%20kaya", undefined, 200));
      assert.equal(byName.data.length, 1);
      assert.equal(byName.pagination.total, 1);
      const byEmail = await expectStatus("GET", "/participants?search=ops@example", undefined, 200);
      assert.equal(byEmail.data[0].id, customer.id);
      const all = await expectStatus("GET", "/participants?status=ACTIVE", undefined, 200);
      assert.equal(all.pagination.total, 2);
    });

    it("rejects invalid input (400)", async () => {
      const bad = [
        { first_name: "A", last_name: "B" },
        { first_name: "A", last_name: "B", email: "not-an-email" },
        { first_name: "A", last_name: "B", email: "a@b.co", birth_date: "1990-02-30" },
        { first_name: "A".repeat(101), last_name: "B", email: "a@b.co" },
        { first_name: "A", last_name: "B", email: "a@b.co", status: "VIP" },
      ];
      for (const body of bad) await expectStatus("POST", "/participants", body, 400);
      await expectStatus("GET", "/participants?status=VIP", undefined, 400);
    });

    it("delete works, but not for a customer with payments (409)", async () => {
      const temp = (await expectStatus("POST", "/participants", { first_name: "Temp", last_name: "User", email: "temp.ops@example.com" }, 201)).data;
      await expectStatus("DELETE", `/participants/${temp.id}`, undefined, 204);
      await expectStatus("GET", `/participants/${temp.id}`, undefined, 404);
    });
  });

  describe("tours, registrations and resources", () => {
    let tour;
    let customer;
    let day;
    let flight;
    let hotel;

    before(async () => {
      customer = (await expectStatus("POST", "/participants", { first_name: "Ayşe", last_name: "Yılmaz", email: "ayse.ops@example.com" }, 201)).data;
    });

    it("tour create / update / search, with date validation", async () => {
      tour = (await expectStatus("POST", "/tours", {
        title: "Kapadokya Turu", destination: "Nevşehir", start_date: "2026-12-10", end_date: "2026-12-13", capacity: 12,
      }, 201)).data;
      assert.equal(tour.status, "DRAFT");

      await expectStatus("POST", "/tours", { title: "X", destination: "Y", start_date: "2026-12-10", end_date: "2026-12-01" }, 400);
      await expectStatus("POST", "/tours", { title: "X", destination: "Y", start_date: "2026-02-30", end_date: "2026-03-01" }, 400);
      await expectStatus("POST", "/tours", { title: "X", destination: "Y", start_date: "2026-12-10", end_date: "2026-12-11", capacity: -1 }, 400);

      const updated = (await expectStatus("PATCH", `/tours/${tour.id}`, { status: "CONFIRMED" }, 200)).data;
      assert.equal(updated.status, "CONFIRMED");

      const found = await expectStatus("GET", "/tours?search=kapadok", undefined, 200);
      assert.equal(found.data[0].id, tour.id);
      await expectStatus("GET", "/tours?status=WHATEVER", undefined, 400);
      await expectStatus("GET", "/tours?startFrom=2026-13-01", undefined, 400);
    });

    it("register a customer on the tour; duplicates are 409", async () => {
      await expectStatus("POST", `/tours/${tour.id}/participants`, { participant_id: customer.id, sale_price: 2500, sale_currency: "TRY" }, 201);
      await expectStatus("POST", `/tours/${tour.id}/participants`, { participant_id: customer.id }, 409);
      await expectStatus("POST", `/tours/${tour.id}/participants`, { participant_id: "abc" }, 400);

      const tours = (await expectStatus("GET", `/participants/${customer.id}/tours`, undefined, 200)).data;
      assert.equal(tours.length, 1);
      assert.equal(tours[0].title, "Kapadokya Turu");
    });

    it("flights: create, list company-wide, update, validation", async () => {
      flight = (await expectStatus("POST", `/tours/${tour.id}/flights`, {
        airline: "Anadolu Test Air", flight_number: "AT123", departure_airport: "IST", arrival_airport: "NAV",
        departure_datetime: "2026-12-10T08:00", arrival_datetime: "2026-12-10T09:20",
      }, 201)).data;

      await expectStatus("POST", `/tours/${tour.id}/flights`, {
        airline: "X", flight_number: "1", departure_airport: "A", arrival_airport: "B",
        departure_datetime: "2026-12-10T10:00", arrival_datetime: "2026-12-10T09:00",
      }, 400);
      await expectStatus("POST", `/tours/${tour.id}/flights`, {
        airline: "X", flight_number: "1", departure_airport: "A", arrival_airport: "B",
        departure_datetime: "2026-02-30T10:00", arrival_datetime: "2026-03-01T09:00",
      }, 400);

      const list = await expectStatus("GET", `/flights?tour=${tour.id}&search=AT12`, undefined, 200);
      assert.equal(list.data.length, 1);
      assert.equal(list.data[0].tour_title, "Kapadokya Turu");
      await expectStatus("GET", "/flights?status=LOST", undefined, 400);

      const updated = (await expectStatus("PATCH", `/flights/${flight.id}`, { status: "DELAYED" }, 200)).data;
      assert.equal(updated.status, "DELAYED");
    });

    it("hotels: create, list, update, validation", async () => {
      hotel = (await expectStatus("POST", `/tours/${tour.id}/hotels`, {
        hotel_name: "Test Cave Hotel", city: "Göreme", country: "Türkiye", check_in: "2026-12-10", check_out: "2026-12-13",
      }, 201)).data;
      await expectStatus("POST", `/tours/${tour.id}/hotels`, { hotel_name: "X", check_in: "2026-12-10", check_out: "2026-12-09" }, 400);

      const list = await expectStatus("GET", "/hotels?search=cave", undefined, 200);
      assert.equal(list.data[0].id, hotel.id);
      const updated = (await expectStatus("PATCH", `/hotels/${hotel.id}`, { status: "CONFIRMED" }, 200)).data;
      assert.equal(updated.status, "CONFIRMED");
    });

    it("days and activities: create, list company-wide, time validation", async () => {
      day = (await expectStatus("POST", `/tours/${tour.id}/days`, { day_number: 1, date: "2026-12-10", title: "Varış" }, 201)).data;
      await expectStatus("POST", `/tours/${tour.id}/days`, { day_number: 1, date: "2026-12-11" }, 409);
      await expectStatus("POST", `/tours/${tour.id}/days`, { day_number: 0, date: "2026-12-11" }, 400);

      await expectStatus("POST", `/tour-days/${day.id}/activities`, { title: "Balon Turu", start_time: "05:30", end_time: "07:00" }, 201);
      await expectStatus("POST", `/tour-days/${day.id}/activities`, { title: "X", start_time: "25:00" }, 400);

      const list = await expectStatus("GET", `/activities?tour=${tour.id}`, undefined, 200);
      assert.equal(list.data.length, 1);
      assert.equal(list.data[0].day_number, 1);
      assert.equal(list.data[0].tour_title, "Kapadokya Turu");
    });

    it("documents: only http(s) URLs, listed company-wide", async () => {
      const base = { title: "Vize", category: "VISA", file_name: "vize.pdf" };
      await expectStatus("POST", `/tours/${tour.id}/documents`, { ...base, file_url: "javascript:alert(1)" }, 400);
      await expectStatus("POST", `/tours/${tour.id}/documents`, { ...base, file_url: "not a url" }, 400);
      const doc = (await expectStatus("POST", `/tours/${tour.id}/documents`, { ...base, file_url: "https://files.example.com/vize.pdf", participant_id: customer.id }, 201)).data;

      const list = await expectStatus("GET", "/documents?search=vize", undefined, 200);
      assert.equal(list.data[0].id, doc.id);
      assert.equal(list.data[0].participant_first_name, "Ayşe");
    });

    it("announcements: create, list, publish, delete", async () => {
      const a = (await expectStatus("POST", `/tours/${tour.id}/announcements`, { title: "Toplanma", content: "Saat 05:00'te lobide.", priority: "HIGH" }, 201)).data;
      const published = (await expectStatus("PATCH", `/announcements/${a.id}/publish`, undefined, 200)).data;
      assert.equal(published.status, "PUBLISHED");

      const list = await expectStatus("GET", "/announcements?status=PUBLISHED", undefined, 200);
      assert.ok(list.data.some((row) => row.id === a.id));
      await expectStatus("POST", `/tours/${tour.id}/announcements`, { title: "X" }, 400);

      await expectStatus("DELETE", `/announcements/${a.id}`, undefined, 204);
    });

    it("finance: payments drive paid / remaining / payment status", async () => {
      const pay = (amount, extra = {}) => expectStatus("POST", `/tours/${tour.id}/finance`, {
        type: "INCOME", category: "PARTICIPANT_PAYMENT", amount, currency: "TRY", transaction_date: "2026-11-01",
        status: "COMPLETED", participant_id: customer.id, ...extra,
      }, 201);

      const first = (await pay(1000)).data;
      let summary = (await expectStatus("GET", `/tours/${tour.id}/finance/summary`, undefined, 200)).data;
      let balance = summary.participants.find((p) => p.participant_id === customer.id);
      assert.equal(balance.paid, "1000.00");
      assert.equal(balance.remaining, "1500.00");
      assert.equal(balance.payment_status, "PARTIALLY_PAID");

      // A pending payment doesn't count yet; completing it does.
      const second = (await pay(1500, { status: "PENDING" })).data;
      summary = (await expectStatus("GET", `/tours/${tour.id}/finance/summary`, undefined, 200)).data;
      assert.equal(summary.participants[0].payment_status, "PARTIALLY_PAID");
      await expectStatus("PATCH", `/finance/transactions/${second.id}`, { status: "COMPLETED" }, 200);
      summary = (await expectStatus("GET", `/tours/${tour.id}/finance/summary`, undefined, 200)).data;
      balance = summary.participants[0];
      assert.equal(balance.remaining, "0.00");
      assert.equal(balance.payment_status, "PAID");
      assert.deepEqual(summary.outstanding, []);

      // Cancelling a payment re-opens the balance.
      await expectStatus("PATCH", `/finance/transactions/${first.id}/cancel`, undefined, 200);
      summary = (await expectStatus("GET", `/tours/${tour.id}/finance/summary`, undefined, 200)).data;
      assert.equal(summary.participants[0].payment_status, "PARTIALLY_PAID");
      assert.deepEqual(summary.outstanding, [{ currency: "TRY", amount: "1000.00" }]);

      // Expenses reduce the net result; totals are per currency.
      await expectStatus("POST", `/tours/${tour.id}/finance`, {
        type: "EXPENSE", category: "HOTEL", amount: 600, currency: "TRY", transaction_date: "2026-11-02", status: "COMPLETED",
      }, 201);
      await expectStatus("POST", `/tours/${tour.id}/finance`, {
        type: "EXPENSE", category: "GUIDE", amount: 50, currency: "EUR", transaction_date: "2026-11-02", status: "COMPLETED",
      }, 201);
      summary = (await expectStatus("GET", `/tours/${tour.id}/finance/summary`, undefined, 200)).data;
      const tryTotals = summary.totals.find((t) => t.currency === "TRY");
      const eurTotals = summary.totals.find((t) => t.currency === "EUR");
      assert.deepEqual(
        { income: tryTotals.income, expense: tryTotals.expense, net: tryTotals.net },
        { income: "1500.00", expense: "600.00", net: "900.00" }
      );
      assert.equal(eurTotals.net, "-50.00");

      // The customer with payments can no longer be deleted.
      await expectStatus("DELETE", `/participants/${customer.id}`, undefined, 409);
    });

    it("finance validation: type/category pairing, amount, date", async () => {
      const base = { type: "INCOME", category: "TOUR_SALE", amount: 10, currency: "TRY", transaction_date: "2026-11-01" };
      await expectStatus("POST", `/tours/${tour.id}/finance`, { ...base, category: "HOTEL" }, 422);
      await expectStatus("POST", `/tours/${tour.id}/finance`, { ...base, amount: -5 }, 400);
      await expectStatus("POST", `/tours/${tour.id}/finance`, { ...base, transaction_date: "2026-02-30" }, 400);
      await expectStatus("POST", `/tours/${tour.id}/finance`, { ...base, currency: "JPY" }, 400);
      await expectStatus("POST", `/tours/${tour.id}/finance`, { ...base, reference_number: "R-1" }, 201);
      await expectStatus("POST", `/tours/${tour.id}/finance`, { ...base, reference_number: "R-1" }, 409);
    });

    it("company finance summary and dashboard reflect the data", async () => {
      const finance = (await expectStatus("GET", "/finance/summary", undefined, 200)).data;
      assert.ok(finance.totals.some((t) => t.currency === "TRY"));
      assert.deepEqual(finance.outstanding, [{ currency: "TRY", amount: "1000.00" }]);

      const dashboard = (await expectStatus("GET", "/dashboard/summary", undefined, 200)).data;
      assert.ok(dashboard.customers.total >= 3);
      assert.equal(dashboard.tours.total, 1);
      assert.equal(dashboard.tours.upcoming, 1);
      assert.equal(dashboard.registrations, 1);
      assert.equal(dashboard.upcoming_tours[0].id, tour.id);
      assert.equal(dashboard.upcoming_tours[0].participant_count, 1);
      assert.deepEqual(dashboard.finance.outstanding, finance.outstanding);
    });

    it("tour delete is blocked while finance records exist (409)", async () => {
      await expectStatus("DELETE", `/tours/${tour.id}`, undefined, 409);
    });

    it("a tour without finance records can be deleted, cascading its resources", async () => {
      const temp = (await expectStatus("POST", "/tours", { title: "Silinecek", destination: "X", start_date: "2027-01-01", end_date: "2027-01-02" }, 201)).data;
      await expectStatus("POST", `/tours/${temp.id}/hotels`, { hotel_name: "H", check_in: "2027-01-01", check_out: "2027-01-02" }, 201);
      await expectStatus("DELETE", `/tours/${temp.id}`, undefined, 204);
      await expectStatus("GET", `/tours/${temp.id}`, undefined, 404);
    });
  });
});
