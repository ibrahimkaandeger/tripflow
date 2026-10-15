const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const dashboardService = require("../services/dashboardService");

const summary = asyncHandler(async (req, res) => {
  sendSuccess(res, await dashboardService.getDashboardSummary(req.membership));
});

module.exports = { summary };
