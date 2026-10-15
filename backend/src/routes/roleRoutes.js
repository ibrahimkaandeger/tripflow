const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { validateIdParams } = require("../middleware/validateIdParams");
const roleController = require("../controllers/roleController");

const router = express.Router();

router.get("/roles", authMiddleware, requireCompanyMembership, requirePermission("roles.read"), roleController.list);
router.post("/roles", authMiddleware, requireCompanyMembership, requirePermission("roles.create"), roleController.create);
router.get("/roles/:id", authMiddleware, validateIdParams("id"), requireCompanyMembership, requirePermission("roles.read"), roleController.getById);
router.patch("/roles/:id", authMiddleware, validateIdParams("id"), requireCompanyMembership, requirePermission("roles.update"), roleController.update);
router.get("/roles/:id/permissions", authMiddleware, validateIdParams("id"), requireCompanyMembership, requirePermission("roles.read"), roleController.getPermissions);
router.put("/roles/:id/permissions", authMiddleware, validateIdParams("id"), requireCompanyMembership, requirePermission("roles.update"), roleController.setPermissions);

module.exports = router;
