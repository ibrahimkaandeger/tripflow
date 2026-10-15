const assert = require("node:assert/strict");
const { apiRequest } = require("./api");

// Builds one company's full operational data set through the real API
// (as its OWNER): a tour with a registered, priced customer, a flight, a
// hotel, a day with an activity, a document, an announcement and a
// completed payment. Returns every created id so tests can probe access
// to each resource type.
async function createOperationalScenario(baseUrl, owner, companyId, label) {
  const opts = (body) => ({ token: owner.token, companyId, body });
  const ok = async (method, path, body, status = 201) => {
    const res = await apiRequest(baseUrl, method, path, opts(body));
    assert.equal(res.status, status, `${method} ${path}: ${JSON.stringify(res.body)}`);
    return res.body.data;
  };

  const tour = await ok("POST", "/tours", {
    title: `${label} Tour`, destination: `${label} City`, start_date: "2026-11-01", end_date: "2026-11-05", capacity: 20,
  });
  const participant = await ok("POST", "/participants", {
    first_name: `${label}First`, last_name: `${label}Last`, email: `${label.toLowerCase()}_${Date.now()}@example.com`,
  });
  await ok("POST", `/tours/${tour.id}/participants`, {
    participant_id: participant.id, sale_price: 1000, sale_currency: "EUR",
  });
  const flight = await ok("POST", `/tours/${tour.id}/flights`, {
    airline: `${label} Air`, flight_number: "TF100", departure_airport: "IST", arrival_airport: "FCO",
    departure_datetime: "2026-11-01T09:00", arrival_datetime: "2026-11-01T11:30",
  });
  const hotel = await ok("POST", `/tours/${tour.id}/hotels`, {
    hotel_name: `${label} Hotel`, city: "Rome", check_in: "2026-11-01", check_out: "2026-11-05",
  });
  const day = await ok("POST", `/tours/${tour.id}/days`, { day_number: 1, date: "2026-11-01", title: "Arrival" });
  const activity = await ok("POST", `/tour-days/${day.id}/activities`, {
    title: `${label} Walking Tour`, location: "Centro", start_time: "14:00", end_time: "16:00",
  });
  const document = await ok("POST", `/tours/${tour.id}/documents`, {
    title: `${label} Program`, category: "PROGRAM", file_name: "program.pdf", file_url: "https://files.example.com/program.pdf",
  });
  const announcement = await ok("POST", `/tours/${tour.id}/announcements`, {
    title: `${label} Welcome`, content: "Meet at the lobby at 9.",
  });
  const payment = await ok("POST", `/tours/${tour.id}/finance`, {
    type: "INCOME", category: "PARTICIPANT_PAYMENT", amount: 400, currency: "EUR",
    transaction_date: "2026-10-01", status: "COMPLETED", participant_id: participant.id,
  });

  return { tour, participant, flight, hotel, day, activity, document, announcement, payment };
}

module.exports = { createOperationalScenario };
