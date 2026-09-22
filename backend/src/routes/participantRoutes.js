const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { requireResourceOwnership, getParticipantCompanyId } = require("../services/resourceScopeService");
const participantController = require("../controllers/participantController");

const router = express.Router();

router.get("/participants", authMiddleware, requireCompanyMembership, requirePermission("participants.read"), participantController.list);
router.post("/participants", authMiddleware, requireCompanyMembership, requirePermission("participants.create"), participantController.create);
router.get("/participants/:id", authMiddleware, requireCompanyMembership, requirePermission("participants.read"), requireResourceOwnership(getParticipantCompanyId), participantController.getById);
router.patch("/participants/:id", authMiddleware, requireCompanyMembership, requirePermission("participants.update"), requireResourceOwnership(getParticipantCompanyId), participantController.update);

module.exports = router;
