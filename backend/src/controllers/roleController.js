const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const roleService = require("../services/roleService");

const list = asyncHandler(async (req, res) => {
  const roles = await roleService.listRoles(req.membership.companyId);
  sendSuccess(res, roles);
});

const getById = asyncHandler(async (req, res) => {
  const role = await roleService.getRoleById(req.membership.companyId, req.params.id);
  sendSuccess(res, role);
});

const create = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.membership.companyId, req.body);
  sendSuccess(res, role, 201);
});

const update = asyncHandler(async (req, res) => {
  const role = await roleService.updateRole(req.membership.companyId, req.params.id, req.body);
  sendSuccess(res, role);
});

const getPermissions = asyncHandler(async (req, res) => {
  const permissions = await roleService.getRolePermissions(req.membership.companyId, req.params.id);
  sendSuccess(res, permissions);
});

const setPermissions = asyncHandler(async (req, res) => {
  const permissions = await roleService.setRolePermissions(req.membership.companyId, req.params.id, req.body.permissionIds);
  sendSuccess(res, permissions);
});

module.exports = { list, getById, create, update, getPermissions, setPermissions };
