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

const create = asyncHandler(async (req, res) => {
  const company = await companyService.createCompanyForUser(req.user.id, req.body);
  sendSuccess(res, company, 201);
});

const getMyPermissions = asyncHandler(async (req, res) => {
  sendSuccess(res, await companyService.getMembershipPermissions(req.membership));
});

module.exports = { getMe, updateMe, create, getMyPermissions };
