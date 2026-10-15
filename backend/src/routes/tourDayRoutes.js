const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { requireResourceOwnership, getTourCompanyId } = require("../services/resourceScopeService");
const controller = require("../controllers/tourDayController");
const { validateIdParams } = require("../middleware/validateIdParams");

const router = express.Router();
const scoped = [authMiddleware, requireCompanyMembership, requireResourceOwnership(getTourCompanyId, "tourId")];

// No dedicated tour_days.* permission key exists in the database, so
// this sub-resource of a tour uses tours.read/tours.update -- the
// same keys that gate the tour itself. This mirrors real Phase 3
// grants (STAFF has activities.* but not tours.update), which is
// exactly the intended boundary: staff manage daily activities, not
// the tour's own day structure.
router.get("/tours/:tourId/days", ...scoped, requirePermission("tours.read"), controller.list);
router.post("/tours/:tourId/days", ...scoped, requirePermission("tours.update"), controller.create);
router.get("/tours/:tourId/days/:dayId", ...scoped, validateIdParams("dayId"), requirePermission("tours.read"), controller.getById);
router.patch("/tours/:tourId/days/:dayId", ...scoped, validateIdParams("dayId"), requirePermission("tours.update"), controller.update);
router.delete("/tours/:tourId/days/:dayId", ...scoped, validateIdParams("dayId"), requirePermission("tours.update"), controller.remove);

module.exports = router;
