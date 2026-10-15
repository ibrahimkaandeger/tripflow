// Demo data for local development, screenshots and portfolio reviews.
// Everything here is fictional: names are invented, every email uses a
// domain reserved for examples ("tripflow.test", "example.com" -- RFC
// 2606), phone numbers are placeholders and file URLs point at
// example.com.
//
//   npm run seed:demo            create the demo company (skips if present)
//   npm run seed:demo -- --reset remove the demo company + demo users, then recreate
//
// Dates are relative to today, so the demo always has an ongoing tour,
// upcoming tours and a completed one. Refuses to run in production.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../../src/config/db");
const { syncPaymentStatus } = require("../../src/services/financeSummaryService");

const COMPANY_NAME = "Anatolia Trails (Demo)";
const DEMO_PASSWORD = "Demo1234!";
const USERS = [
  { name: "Deniz Yılmaz", email: "owner@tripflow.test", role: "OWNER" },
  { name: "Kerem Aydın", email: "manager@tripflow.test", role: "MANAGER" },
  { name: "Selin Kaya", email: "staff@tripflow.test", role: "STAFF" },
  { name: "Mert Demir", email: "viewer@tripflow.test", role: "VIEWER" },
];

const CUSTOMERS = [
  ["Elif", "Arslan", "İstanbul"], ["Can", "Öztürk", "Ankara"], ["Zeynep", "Çelik", "İzmir"],
  ["Burak", "Şahin", "Bursa"], ["Ayşe", "Koç", "Antalya"], ["Emre", "Yıldız", "Eskişehir"],
  ["Deniz", "Aksoy", "Muğla"], ["Ece", "Polat", "Konya"], ["Onur", "Erdem", "Trabzon"],
  ["Irmak", "Güneş", "Mersin"],
];

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function reset(client) {
  const company = await client.query("SELECT id FROM companies WHERE name = $1", [COMPANY_NAME]);
  if (company.rows.length > 0) {
    const id = company.rows[0].id;
    // finance_transactions are RESTRICT on company/tour: clear them first.
    await client.query("DELETE FROM finance_transactions WHERE company_id = $1", [id]);
    await client.query("DELETE FROM companies WHERE id = $1", [id]);
  }
  await client.query("DELETE FROM users WHERE email = ANY($1)", [USERS.map((u) => u.email)]);
}

async function seed(client) {
  const roles = await client.query("SELECT id, name FROM roles WHERE company_id IS NULL");
  const roleId = Object.fromEntries(roles.rows.map((r) => [r.name, r.id]));
  if (!roleId.VIEWER) throw new Error("VIEWER role missing -- run `npm run migrate` first.");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const company = (await client.query(
    `INSERT INTO companies (name, legal_name, email, phone, website, city, country)
     VALUES ($1, 'Anatolia Trails Turizm Ltd. (Demo)', 'info@tripflow.test', '+90 212 000 00 00', 'https://example.com', 'İstanbul', 'Türkiye')
     RETURNING id`,
    [COMPANY_NAME]
  )).rows[0].id;

  const userIds = {};
  for (const user of USERS) {
    const id = (await client.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id",
      [user.name, user.email, passwordHash]
    )).rows[0].id;
    userIds[user.role] = id;
    await client.query(
      "INSERT INTO company_users (company_id, user_id, role_id, status) VALUES ($1, $2, $3, 'ACTIVE')",
      [company, id, roleId[user.role]]
    );
  }
  const ownerId = userIds.OWNER;

  const customerIds = [];
  for (const [i, [first, last, city]] of CUSTOMERS.entries()) {
    const email = `${first}.${last}`.toLowerCase()
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
      + "@example.com";
    customerIds.push((await client.query(
      `INSERT INTO participants (company_id, first_name, last_name, email, phone, city, passport_country, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Türkiye', $7) RETURNING id`,
      [company, first, last, email, `+90 555 000 00 ${String(i + 10).padStart(2, "0")}`, city, i === 9 ? "INACTIVE" : "ACTIVE"]
    )).rows[0].id);
  }

  const tours = [
    { title: "Karadeniz Yaylaları", destination: "Trabzon & Rize", start: -2, days: 5, status: "ONGOING", capacity: 16, price: 18500, currency: "TRY", customers: [0, 1, 2, 3, 4] },
    { title: "Kapadokya Balon Turu", destination: "Nevşehir", start: 12, days: 4, status: "CONFIRMED", capacity: 12, price: 24000, currency: "TRY", customers: [2, 5, 6, 7] },
    { title: "İtalya Klasikleri", destination: "Roma & Floransa", start: 35, days: 7, status: "PLANNED", capacity: 20, price: 1450, currency: "EUR", customers: [0, 3, 8] },
    { title: "Ege Koyları Mavi Yolculuk", destination: "Bodrum & Göcek", start: -60, days: 6, status: "COMPLETED", capacity: 10, price: 32000, currency: "TRY", customers: [1, 4, 6] },
    { title: "Kış Kapadokya (Taslak)", destination: "Nevşehir", start: 90, days: 3, status: "DRAFT", capacity: null, price: null, currency: null, customers: [] },
  ];

  const programs = {
    "Karadeniz Yaylaları": [["Varış ve Uzungöl", [["10:00", "12:00", "Uzungöl yürüyüşü", "Uzungöl"]]], ["Ayder Yaylası", [["09:30", "16:00", "Ayder yayla turu", "Ayder"], ["19:00", "21:00", "Yöresel akşam yemeği", "Ayder"]]], ["Sümela Manastırı", [["10:00", "13:00", "Sümela ziyareti", "Maçka"]]]],
    "Kapadokya Balon Turu": [["Varış", [["15:00", "17:00", "Göreme Açık Hava Müzesi", "Göreme"]]], ["Balon ve vadiler", [["05:30", "07:00", "Sıcak hava balonu", "Göreme Vadisi"], ["10:00", "13:00", "Kızılçukur vadisi yürüyüşü", "Çavuşin"]]]],
    "İtalya Klasikleri": [["Roma'ya varış", [["16:00", "18:00", "Trevi ve İspanyol Merdivenleri", "Roma"]]], ["Antik Roma", [["09:00", "13:00", "Kolezyum ve Forum", "Roma"]]], ["Floransa", [["10:00", "12:30", "Uffizi Galerisi", "Floransa"]]]],
    "Ege Koyları Mavi Yolculuk": [["Bodrum'dan hareket", [["11:00", "18:00", "Orak Adası rotası", "Bodrum"]]]],
  };

  for (const tour of tours) {
    const start = day(tour.start);
    const end = day(tour.start + tour.days - 1);
    const tourId = (await client.query(
      `INSERT INTO tours (company_id, title, description, destination, start_date, end_date, status, capacity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [company, tour.title, `${tour.destination} rotasında ${tour.days} günlük grup turu. (Demo verisi)`, tour.destination, start, end, tour.status, tour.capacity, ownerId]
    )).rows[0].id;

    for (const [idx, customerIndex] of tour.customers.entries()) {
      await client.query(
        `INSERT INTO tour_participants (tour_id, participant_id, status, room_number, sale_price, sale_currency)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tourId, customerIds[customerIndex], tour.status === "COMPLETED" ? "COMPLETED" : idx === 0 ? "CONFIRMED" : "REGISTERED",
         `${100 + idx}`, tour.price, tour.currency]
      );
    }

    for (const [dayIndex, [title, activities]] of (programs[tour.title] || []).entries()) {
      const dayId = (await client.query(
        "INSERT INTO tour_days (tour_id, day_number, date, title) VALUES ($1, $2, $3, $4) RETURNING id",
        [tourId, dayIndex + 1, day(tour.start + dayIndex), title]
      )).rows[0].id;
      for (const [startTime, endTime, activityTitle, location] of activities) {
        await client.query(
          "INSERT INTO activities (tour_day_id, title, location, start_time, end_time) VALUES ($1, $2, $3, $4, $5)",
          [dayId, activityTitle, location, startTime, endTime]
        );
      }
    }

    if (tour.status !== "DRAFT") {
      const abroad = tour.currency === "EUR";
      await client.query(
        `INSERT INTO flights (tour_id, airline, flight_number, departure_airport, arrival_airport, departure_datetime, arrival_datetime, booking_reference, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [tourId, abroad ? "Demo Airways" : "Anadolu Demo Air", abroad ? "DA1907" : "AD2204", "IST", abroad ? "FCO" : tour.title.startsWith("Kapadokya") ? "NAV" : tour.title.startsWith("Karadeniz") ? "TZX" : "BJV",
         `${start} 08:15`, `${start} ${abroad ? "10:45" : "09:40"}`, `PNR${tourId}X`, tour.status === "COMPLETED" ? "COMPLETED" : "SCHEDULED"]
      );
      await client.query(
        `INSERT INTO hotels (tour_id, hotel_name, city, country, check_in, check_out, booking_reference, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [tourId, `${tour.destination.split(" ")[0]} Demo Hotel`, tour.destination.split(" ")[0], abroad ? "İtalya" : "Türkiye", start, end, `HTL-${tourId}`,
         tour.status === "COMPLETED" ? "COMPLETED" : "CONFIRMED"]
      );
      await client.query(
        `INSERT INTO documents (tour_id, title, category, file_name, file_url, visibility, uploaded_by)
         VALUES ($1, $2, 'PROGRAM', 'program.pdf', $3, 'BOTH', $4)`,
        [tourId, `${tour.title} Programı`, `https://example.com/demo/${tourId}/program.pdf`, ownerId]
      );
      await client.query(
        `INSERT INTO announcements (tour_id, title, content, priority, status, published_at, created_by)
         VALUES ($1, $2, $3, $4, 'PUBLISHED', NOW() - INTERVAL '1 day', $5)`,
        [tourId, "Toplanma bilgisi", "İlk gün saat 07:00'de havalimanı dış hatlar girişinde buluşuyoruz.", tour.status === "ONGOING" ? "HIGH" : "NORMAL", ownerId]
      );
    }

    // Payments: the first customer paid in full, the second half, the rest nothing yet.
    if (tour.price) {
      for (const [idx, customerIndex] of tour.customers.entries()) {
        const amount = idx === 0 || tour.status === "COMPLETED" ? tour.price : idx === 1 ? tour.price / 2 : 0;
        if (!amount) continue;
        await client.query(
          `INSERT INTO finance_transactions (company_id, tour_id, participant_id, type, category, amount, currency, status, transaction_date, description, created_by)
           VALUES ($1, $2, $3, 'INCOME', 'PARTICIPANT_PAYMENT', $4, $5, 'COMPLETED', $6, 'Tur ödemesi', $7)`,
          [company, tourId, customerIds[customerIndex], amount, tour.currency, day(Math.min(tour.start - 10, -1)), ownerId]
        );
      }
      await client.query(
        `INSERT INTO finance_transactions (company_id, tour_id, type, category, amount, currency, status, transaction_date, description, created_by)
         VALUES ($1, $2, 'EXPENSE', 'HOTEL', $3, $4, 'COMPLETED', $5, 'Otel ön ödemesi', $6),
                ($1, $2, 'EXPENSE', 'GUIDE', $7, $4, 'PENDING', $5, 'Rehber ücreti', $6)`,
        [company, tourId, Math.round(tour.price * tour.customers.length * 0.35), tour.currency, day(Math.min(tour.start - 5, -1)), ownerId,
         Math.round(tour.price * 0.4)]
      );
    }
  }

  return company;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data with NODE_ENV=production.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (process.argv.includes("--reset")) {
      await reset(client);
    } else {
      const existing = await client.query("SELECT 1 FROM companies WHERE name = $1", [COMPANY_NAME]);
      if (existing.rows.length > 0) {
        await client.query("ROLLBACK");
        console.log(`Demo company "${COMPANY_NAME}" already exists. Use --reset to recreate it.`);
        return;
      }
    }
    const companyId = await seed(client);
    await client.query("COMMIT");

    // Derive every registration's payment status from the seeded payments.
    const registrations = await pool.query(
      "SELECT tp.tour_id, tp.participant_id FROM tour_participants tp JOIN tours t ON t.id = tp.tour_id WHERE t.company_id = $1",
      [companyId]
    );
    for (const row of registrations.rows) await syncPaymentStatus(row.tour_id, row.participant_id);

    console.log(`Demo company "${COMPANY_NAME}" created. Sign in with any of (password: ${DEMO_PASSWORD}):`);
    for (const user of USERS) console.log(`  ${user.role.padEnd(8)} ${user.email}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
