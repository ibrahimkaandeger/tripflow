const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const companyController = require("../controllers/companyController");

const router = express.Router();

// Onboarding: any authenticated user without an active membership may
// create their company and becomes its OWNER.
router.post("/companies", authMiddleware, companyController.create);

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

// The caller's own role + permission keys; membership alone is enough
// (every member may know what they themselves are allowed to do).
router.get(
  "/companies/me/permissions",
  authMiddleware,
  requireCompanyMembership,
  companyController.getMyPermissions
);

module.exports = router;
