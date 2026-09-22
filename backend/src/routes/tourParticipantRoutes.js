const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { requireResourceOwnership, getTourCompanyId } = require("../services/resourceScopeService");
const controller = require("../controllers/tourParticipantController");

const router = express.Router();
const scoped = [authMiddleware, requireCompanyMembership, requireResourceOwnership(getTourCompanyId, "tourId")];

router.get("/tours/:tourId/participants", ...scoped, requirePermission("participants.read"), controller.list);
router.post("/tours/:tourId/participants", ...scoped, requirePermission("participants.update"), controller.add);
router.patch("/tours/:tourId/participants/:participantId", ...scoped, requirePermission("participants.update"), controller.update);
router.delete("/tours/:tourId/participants/:participantId", ...scoped, requirePermission("participants.update"), controller.remove);

module.exports = router;
