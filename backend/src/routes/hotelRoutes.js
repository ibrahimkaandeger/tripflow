const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireCompanyMembership } = require("../middleware/companyMiddleware");
const { requirePermission } = require("../middleware/permissionMiddleware");
const {
  requireResourceOwnership, getTourCompanyId, getHotelCompanyId, getHotelRoomCompanyId,
} = require("../services/resourceScopeService");
const controller = require("../controllers/hotelController");

const router = express.Router();
const auth = [authMiddleware, requireCompanyMembership];

router.get("/tours/:tourId/hotels", ...auth, requireResourceOwnership(getTourCompanyId, "tourId"), requirePermission("hotels.read"), controller.listHotels);
router.post("/tours/:tourId/hotels", ...auth, requireResourceOwnership(getTourCompanyId, "tourId"), requirePermission("hotels.create"), controller.createHotel);
router.get("/hotels/:id", ...auth, requireResourceOwnership(getHotelCompanyId, "id"), requirePermission("hotels.read"), controller.getHotel);
router.patch("/hotels/:id", ...auth, requireResourceOwnership(getHotelCompanyId, "id"), requirePermission("hotels.update"), controller.updateHotel);
router.delete("/hotels/:id", ...auth, requireResourceOwnership(getHotelCompanyId, "id"), requirePermission("hotels.delete"), controller.removeHotel);

router.get("/hotels/:hotelId/rooms", ...auth, requireResourceOwnership(getHotelCompanyId, "hotelId"), requirePermission("hotels.read"), controller.listRooms);
router.post("/hotels/:hotelId/rooms", ...auth, requireResourceOwnership(getHotelCompanyId, "hotelId"), requirePermission("hotels.update"), controller.createRoom);
router.patch("/hotel-rooms/:id", ...auth, requireResourceOwnership(getHotelRoomCompanyId, "id"), requirePermission("hotels.update"), controller.updateRoom);
router.delete("/hotel-rooms/:id", ...auth, requireResourceOwnership(getHotelRoomCompanyId, "id"), requirePermission("hotels.update"), controller.removeRoom);

router.post("/hotel-rooms/:roomId/participants", ...auth, requireResourceOwnership(getHotelRoomCompanyId, "roomId"), requirePermission("hotels.update"), controller.addRoomParticipant);
router.patch("/hotel-rooms/:roomId/participants/:participantId", ...auth, requireResourceOwnership(getHotelRoomCompanyId, "roomId"), requirePermission("hotels.update"), controller.updateRoomParticipant);
router.delete("/hotel-rooms/:roomId/participants/:participantId", ...auth, requireResourceOwnership(getHotelRoomCompanyId, "roomId"), requirePermission("hotels.update"), controller.removeRoomParticipant);

module.exports = router;
