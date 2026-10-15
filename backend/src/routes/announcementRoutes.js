const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const { requireResourceOwnership, getTourCompanyId, getAnnouncementCompanyId } = require("../services/resourceScopeService");
const controller = require("../controllers/announcementController");
const { validateIdParams } = require("../middleware/validateIdParams");

const router = express.Router();
const auth = [authMiddleware, requireCompanyMembership];
const scoped = (resolver, param) => [...auth, requireResourceOwnership(resolver, param)];

router.get("/announcements", ...auth, requirePermission("announcements.read"), controller.listAll);
router.get("/tours/:tourId/announcements", ...scoped(getTourCompanyId, "tourId"), requirePermission("announcements.read"), controller.list);
router.post("/tours/:tourId/announcements", ...scoped(getTourCompanyId, "tourId"), requirePermission("announcements.create"), controller.create);

// Self-service read/unread must come before /:id -- otherwise Express
// would match "unread" as an :id. Authenticated only: these serve
// both company staff and participants (see markAnnouncementRead),
// neither of which is required to be a company member.
router.get("/announcements/unread", authMiddleware, controller.unread);
router.post("/announcements/:id/read", authMiddleware, validateIdParams("id"), controller.markRead);

router.get("/announcements/:id", ...scoped(getAnnouncementCompanyId, "id"), requirePermission("announcements.read"), controller.getById);
router.patch("/announcements/:id", ...scoped(getAnnouncementCompanyId, "id"), requirePermission("announcements.update"), controller.update);
router.delete("/announcements/:id", ...scoped(getAnnouncementCompanyId, "id"), requirePermission("announcements.delete"), controller.remove);
router.patch("/announcements/:id/publish", ...scoped(getAnnouncementCompanyId, "id"), requirePermission("announcements.update"), controller.publish);

module.exports = router;
