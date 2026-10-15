const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { requireResourceOwnership, getParticipantCompanyId } = require("../services/resourceScopeService");
const participantController = require("../controllers/participantController");

const router = express.Router();
const auth = [authMiddleware, requireCompanyMembership];
const owned = requireResourceOwnership(getParticipantCompanyId);

router.get("/participants", ...auth, requirePermission("participants.read"), participantController.list);
router.post("/participants", ...auth, requirePermission("participants.create"), participantController.create);
router.get("/participants/:id", ...auth, requirePermission("participants.read"), owned, participantController.getById);
router.get("/participants/:id/tours", ...auth, requirePermission("participants.read"), owned, participantController.listTours);
router.patch("/participants/:id", ...auth, requirePermission("participants.update"), owned, participantController.update);
router.delete("/participants/:id", ...auth, requirePermission("participants.delete"), owned, participantController.remove);

module.exports = router;
