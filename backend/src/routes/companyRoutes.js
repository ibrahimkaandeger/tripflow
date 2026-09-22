const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const companyController = require("../controllers/companyController");

const router = express.Router();

router.get(
  "/companies/me",
  authMiddleware,
  requireCompanyMembership,
  requirePermission("company.read"),
  companyController.getMe
);

router.patch(
  "/companies/me",
  authMiddleware,
  requireCompanyMembership,
  requirePermission("company.update"),
  companyController.updateMe
);

module.exports = router;
