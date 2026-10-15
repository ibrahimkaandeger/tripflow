const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendList } = require("../utils/response");
const companyUserService = require("../services/companyUserService");

const list = asyncHandler(async (req, res) => {
  const { data, pagination } = await companyUserService.listCompanyUsers(req.membership.companyId, req.query);
  sendList(res, data, pagination);
});

const getById = asyncHandler(async (req, res) => {
  const item = await companyUserService.getCompanyUserById(req.membership.companyId, req.params.id);
  sendSuccess(res, item);
});

const create = asyncHandler(async (req, res) => {
  const item = await companyUserService.createCompanyUser(req.membership.companyId, req.membership.roleId, req.body);
  sendSuccess(res, item, 201);
});

const update = asyncHandler(async (req, res) => {
  const item = await companyUserService.updateCompanyUser(req.membership.companyId, req.membership.roleId, req.user.id, req.params.id, req.body);
  sendSuccess(res, item);
});

module.exports = { list, getById, create, update };
