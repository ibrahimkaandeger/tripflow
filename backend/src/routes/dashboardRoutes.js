const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const controller = require("../controllers/dashboardController");

const router = express.Router();

// reports.read gates the overview (every built-in role has it); the
// finance block inside is additionally limited to finance.read.
router.get("/dashboard/summary", authMiddleware, requireCompanyMembership, requirePermission("reports.read"), controller.summary);

module.exports = router;
