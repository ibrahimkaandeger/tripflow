const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const companyUserController = require("../controllers/companyUserController");

const router = express.Router();

router.get(
  "/company-users",
  authMiddleware, requireCompanyMembership, requirePermission("users.read"),
  companyUserController.list
);

router.post(
  "/company-users",
  authMiddleware, requireCompanyMembership, requirePermission("users.create"),
  companyUserController.create
);

router.get(
  "/company-users/:id",
  authMiddleware, requireCompanyMembership, requirePermission("users.read"),
  companyUserController.getById
);

router.patch(
  "/company-users/:id",
  authMiddleware, requireCompanyMembership, requirePermission("users.update"),
  companyUserController.update
);

module.exports = router;
