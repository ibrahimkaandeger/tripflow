const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { requireResourceOwnership, getTourCompanyId, getFinanceTransactionCompanyId } = require("../services/resourceScopeService");
const controller = require("../controllers/financeController");

const router = express.Router();
const auth = [authMiddleware, requireCompanyMembership];

router.get("/tours/:tourId/finance", ...auth, requireResourceOwnership(getTourCompanyId, "tourId"), requirePermission("finance.read"), controller.listForTour);
router.post("/tours/:tourId/finance", ...auth, requireResourceOwnership(getTourCompanyId, "tourId"), requirePermission("finance.create"), controller.create);
router.get("/finance/transactions", ...auth, requirePermission("finance.read"), controller.listAll);
router.get("/finance/transactions/:id", ...auth, requireResourceOwnership(getFinanceTransactionCompanyId, "id"), requirePermission("finance.read"), controller.getById);
router.patch("/finance/transactions/:id", ...auth, requireResourceOwnership(getFinanceTransactionCompanyId, "id"), requirePermission("finance.update"), controller.update);
router.patch("/finance/transactions/:id/cancel", ...auth, requireResourceOwnership(getFinanceTransactionCompanyId, "id"), requirePermission("finance.update"), controller.cancel);

module.exports = router;
