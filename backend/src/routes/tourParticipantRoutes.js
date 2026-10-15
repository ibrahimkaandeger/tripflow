const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission, requirePermissionForFields } = require("../middleware/permissionMiddleware");
const { validateIdParams } = require("../middleware/validateIdParams");
const { requireResourceOwnership, getTourCompanyId } = require("../services/resourceScopeService");
const controller = require("../controllers/tourParticipantController");
const { FINANCIAL_FIELDS } = require("../services/tourParticipantService");

const router = express.Router();
const scoped = [authMiddleware, validateIdParams("tourId"), requireCompanyMembership, requireResourceOwnership(getTourCompanyId, "tourId")];
const scopedWithParticipant = [authMiddleware, validateIdParams("tourId", "participantId"), requireCompanyMembership, requireResourceOwnership(getTourCompanyId, "tourId")];

// sale_price / sale_currency / payment_status are finance data living on
// tour_participants: writing them additionally requires finance.update,
// on top of participants.update (which alone still covers every other field).
const guardFinancialFields = requirePermissionForFields(FINANCIAL_FIELDS, "finance.update");

router.get("/tours/:tourId/participants", ...scoped, requirePermission("participants.read"), controller.list);
router.post("/tours/:tourId/participants", ...scoped, requirePermission("participants.update"), guardFinancialFields, controller.add);
router.patch("/tours/:tourId/participants/:participantId", ...scopedWithParticipant, requirePermission("participants.update"), guardFinancialFields, controller.update);
router.delete("/tours/:tourId/participants/:participantId", ...scopedWithParticipant, requirePermission("participants.update"), controller.remove);

module.exports = router;
