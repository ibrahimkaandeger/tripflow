const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { validateIdParams } = require("../middleware/validateIdParams");
const { requireResourceOwnership, getTourCompanyId, getFinanceTransactionCompanyId } = require("../services/resourceScopeService");
const controller = require("../controllers/financeController");

const router = express.Router();
const auth = [authMiddleware, requireCompanyMembership];
// Malformed ids are rejected with 400 right after authentication, before
// they can reach Postgres; valid-but-missing ids still end in 404.
const tourScoped = [authMiddleware, validateIdParams("tourId"), requireCompanyMembership, requireResourceOwnership(getTourCompanyId, "tourId")];
const transactionScoped = [authMiddleware, validateIdParams("id"), requireCompanyMembership, requireResourceOwnership(getFinanceTransactionCompanyId, "id")];

router.get("/tours/:tourId/finance", ...tourScoped, requirePermission("finance.read"), controller.listForTour);
router.post("/tours/:tourId/finance", ...tourScoped, requirePermission("finance.create"), controller.create);
router.get("/tours/:tourId/finance/summary", ...tourScoped, requirePermission("finance.read"), controller.tourSummary);
router.get("/finance/summary", ...auth, requirePermission("finance.read"), controller.companySummary);
router.get("/finance/transactions", ...auth, requirePermission("finance.read"), controller.listAll);
router.get("/finance/transactions/:id", ...transactionScoped, requirePermission("finance.read"), controller.getById);
router.patch("/finance/transactions/:id", ...transactionScoped, requirePermission("finance.update"), controller.update);
router.patch("/finance/transactions/:id/cancel", ...transactionScoped, requirePermission("finance.update"), controller.cancel);

module.exports = router;
