const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireParticipantTourAccess } = require("../services/participantScopeService");
const controller = require("../controllers/participantSelfController");

const router = express.Router();
const scoped = [authMiddleware, requireParticipantTourAccess];

// Participant self-service. Never touches company_users/role_permissions
// -- access is entirely determined by participants.user_id + being
// registered on the tour via tour_participants (requireParticipantTourAccess).
// Company admin endpoints (companyRoutes/companyUserRoutes/roleRoutes/etc.)
// are a completely separate middleware chain a participant can never
// satisfy, since they aren't in company_users at all.
router.get("/me/tours", authMiddleware, controller.listMyTours);
router.get("/me/tours/:tourId/program", ...scoped, controller.getProgram);
router.get("/me/tours/:tourId/flights", ...scoped, controller.getFlights);
router.get("/me/tours/:tourId/hotels", ...scoped, controller.getHotels);
router.get("/me/tours/:tourId/announcements", ...scoped, controller.getAnnouncements);
router.get("/me/tours/:tourId/documents", ...scoped, controller.getDocuments);
router.get("/me/tours/:tourId/documents/:documentId", ...scoped, controller.getDocumentById);
router.get("/me/tours/:tourId/payments", ...scoped, controller.getPayments);

module.exports = router;
