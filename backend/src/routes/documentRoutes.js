const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { requireResourceOwnership, getTourCompanyId, getDocumentCompanyId } = require("../services/resourceScopeService");
const controller = require("../controllers/documentController");

const router = express.Router();
const auth = [authMiddleware, requireCompanyMembership];

router.get("/documents", ...auth, requirePermission("documents.read"), controller.listAll);
router.get("/tours/:tourId/documents", ...auth, requireResourceOwnership(getTourCompanyId, "tourId"), requirePermission("documents.read"), controller.list);
router.post("/tours/:tourId/documents", ...auth, requireResourceOwnership(getTourCompanyId, "tourId"), requirePermission("documents.create"), controller.create);
router.get("/documents/:id", ...auth, requireResourceOwnership(getDocumentCompanyId, "id"), requirePermission("documents.read"), controller.getById);
router.patch("/documents/:id", ...auth, requireResourceOwnership(getDocumentCompanyId, "id"), requirePermission("documents.update"), controller.update);
router.delete("/documents/:id", ...auth, requireResourceOwnership(getDocumentCompanyId, "id"), requirePermission("documents.delete"), controller.remove);

module.exports = router;
