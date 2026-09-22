const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { requireResourceOwnership, getTourDayCompanyId, getActivityCompanyId } = require("../services/resourceScopeService");
const controller = require("../controllers/businessActivityController");

const router = express.Router();

// Mounted separately from the legacy /api/activities router (untouched,
// still POST / and GET /:tripDayId). These paths only add PATCH/DELETE
// on /api/activities/:id and the new /api/tour-days/:dayId/activities
// pair, so there is no method/path overlap with the legacy routes.
router.get(
  "/tour-days/:dayId/activities",
  authMiddleware, requireCompanyMembership,
  requireResourceOwnership(getTourDayCompanyId, "dayId"),
  requirePermission("activities.read"),
  controller.list
);

router.post(
  "/tour-days/:dayId/activities",
  authMiddleware, requireCompanyMembership,
  requireResourceOwnership(getTourDayCompanyId, "dayId"),
  requirePermission("activities.create"),
  controller.create
);

router.patch(
  "/activities/:id",
  authMiddleware, requireCompanyMembership,
  requireResourceOwnership(getActivityCompanyId, "id"),
  requirePermission("activities.update"),
  controller.update
);

router.delete(
  "/activities/:id",
  authMiddleware, requireCompanyMembership,
  requireResourceOwnership(getActivityCompanyId, "id"),
  requirePermission("activities.delete"),
  controller.remove
);

module.exports = router;
