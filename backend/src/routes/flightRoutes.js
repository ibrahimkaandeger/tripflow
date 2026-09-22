const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { requireResourceOwnership, getTourCompanyId, getFlightCompanyId } = require("../services/resourceScopeService");
const controller = require("../controllers/flightController");

const router = express.Router();
const auth = [authMiddleware, requireCompanyMembership];

router.get("/tours/:tourId/flights", ...auth, requireResourceOwnership(getTourCompanyId, "tourId"), requirePermission("flights.read"), controller.list);
router.post("/tours/:tourId/flights", ...auth, requireResourceOwnership(getTourCompanyId, "tourId"), requirePermission("flights.create"), controller.create);
router.get("/flights/:id", ...auth, requireResourceOwnership(getFlightCompanyId, "id"), requirePermission("flights.read"), controller.getById);
router.patch("/flights/:id", ...auth, requireResourceOwnership(getFlightCompanyId, "id"), requirePermission("flights.update"), controller.update);
router.delete("/flights/:id", ...auth, requireResourceOwnership(getFlightCompanyId, "id"), requirePermission("flights.delete"), controller.remove);

router.post("/flights/:flightId/participants", ...auth, requireResourceOwnership(getFlightCompanyId, "flightId"), requirePermission("flights.update"), controller.addParticipant);
router.patch("/flights/:flightId/participants/:participantId", ...auth, requireResourceOwnership(getFlightCompanyId, "flightId"), requirePermission("flights.update"), controller.updateParticipant);
router.delete("/flights/:flightId/participants/:participantId", ...auth, requireResourceOwnership(getFlightCompanyId, "flightId"), requirePermission("flights.update"), controller.removeParticipant);

module.exports = router;
