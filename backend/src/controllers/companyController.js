const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const companyService = require("../services/companyService");

const getMe = asyncHandler(async (req, res) => {
  const company = await companyService.getCompanyById(req.membership.companyId);
  sendSuccess(res, company);
});

const updateMe = asyncHandler(async (req, res) => {
  const company = await companyService.updateCompany(req.membership.companyId, req.body);
  sendSuccess(res, company);
});

module.exports = { getMe, updateMe };
