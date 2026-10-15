const pool = require("../config/db");
const { roleHasPermission } = require("../middleware/permissionMiddleware");
const { getCompanyFinanceSummary } = require("./financeSummaryService");

const UPCOMING_LIST_SIZE = 5;

// Operational overview for one company. "Today" is the database's
// CURRENT_DATE so every metric uses the same clock. The finance block
// is only included for callers who may read finance data.
async function getDashboardSummary(membership) {
  const companyId = membership.companyId;

  const customers = await pool.query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active
     FROM participants WHERE company_id = $1`,
    [companyId]
  );

  const tours = await pool.query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (
              WHERE status = 'ONGOING'
                 OR (status IN ('PLANNED', 'CONFIRMED') AND CURRENT_DATE BETWEEN start_date AND end_date)
            ) AS active,
            COUNT(*) FILTER (
              WHERE start_date > CURRENT_DATE AND status NOT IN ('CANCELLED', 'COMPLETED')
            ) AS upcoming
     FROM tours WHERE company_id = $1`,
    [companyId]
  );

  const byStatus = await pool.query(
    "SELECT status, COUNT(*) AS count FROM tours WHERE company_id = $1 GROUP BY status",
    [companyId]
  );

  const registrations = await pool.query(
    `SELECT COUNT(*) AS total
     FROM tour_participants tp JOIN tours t ON t.id = tp.tour_id
     WHERE t.company_id = $1 AND tp.status <> 'CANCELLED'`,
    [companyId]
  );

  const upcomingTours = await pool.query(
    `SELECT t.id, t.title, t.destination, t.start_date, t.end_date, t.status, t.capacity,
            (SELECT COUNT(*) FROM tour_participants tp
             WHERE tp.tour_id = t.id AND tp.status <> 'CANCELLED') AS participant_count
     FROM tours t
     WHERE t.company_id = $1 AND t.end_date >= CURRENT_DATE AND t.status NOT IN ('CANCELLED', 'COMPLETED')
     ORDER BY t.start_date, t.id
     LIMIT $2`,
    [companyId, UPCOMING_LIST_SIZE]
  );

  const canReadFinance = await roleHasPermission(membership.roleId, "finance.read");

  return {
    customers: {
      total: Number(customers.rows[0].total),
      active: Number(customers.rows[0].active),
    },
    tours: {
      total: Number(tours.rows[0].total),
      active: Number(tours.rows[0].active),
      upcoming: Number(tours.rows[0].upcoming),
      by_status: Object.fromEntries(byStatus.rows.map((row) => [row.status, Number(row.count)])),
    },
    registrations: Number(registrations.rows[0].total),
    upcoming_tours: upcomingTours.rows.map((row) => ({ ...row, participant_count: Number(row.participant_count) })),
    finance: canReadFinance ? await getCompanyFinanceSummary(companyId) : null,
  };
}

module.exports = { getDashboardSummary };
