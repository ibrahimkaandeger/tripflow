const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { requireResourceOwnership, getTourCompanyId } = require("../services/resourceScopeService");
const tourController = require("../controllers/tourController");

const router = express.Router();

router.get("/tours", authMiddleware, requireCompanyMembership, requirePermission("tours.read"), tourController.list);
router.post("/tours", authMiddleware, requireCompanyMembership, requirePermission("tours.create"), tourController.create);
router.get("/tours/:id", authMiddleware, requireCompanyMembership, requirePermission("tours.read"), requireResourceOwnership(getTourCompanyId), tourController.getById);
router.patch("/tours/:id", authMiddleware, requireCompanyMembership, requirePermission("tours.update"), requireResourceOwnership(getTourCompanyId), tourController.update);
router.delete("/tours/:id", authMiddleware, requireCompanyMembership, requirePermission("tours.delete"), requireResourceOwnership(getTourCompanyId), tourController.remove);

module.exports = router;
