const { roleHasPermission } = require("../middleware/permissionMiddleware");

// Finance-owned columns on tour_participants.
const PARTICIPANT_FINANCIAL_FIELDS = ["sale_price", "sale_currency", "payment_status"];

// participants.read alone must not reveal finance data: without
// finance.read the financial columns are removed from the response
// itself, not merely hidden by the client.
async function withoutFinanceUnlessAllowed(req, rows) {
  if (await roleHasPermission(req.membership.roleId, "finance.read")) {
    return rows;
  }
  return rows.map((row) => {
    const copy = { ...row };
    for (const field of PARTICIPANT_FINANCIAL_FIELDS) delete copy[field];
    return copy;
  });
}

module.exports = { PARTICIPANT_FINANCIAL_FIELDS, withoutFinanceUnlessAllowed };
