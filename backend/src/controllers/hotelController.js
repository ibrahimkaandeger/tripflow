const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const hotelService = require("../services/hotelService");

const listHotels = asyncHandler(async (req, res) => sendSuccess(res, await hotelService.listHotelsForTour(req.params.tourId)));
const createHotel = asyncHandler(async (req, res) => sendSuccess(res, await hotelService.createHotel(req.params.tourId, req.body), 201));
const getHotel = asyncHandler(async (req, res) => sendSuccess(res, await hotelService.getHotelById(req.params.id)));
const updateHotel = asyncHandler(async (req, res) => sendSuccess(res, await hotelService.updateHotel(req.params.id, req.body)));
const removeHotel = asyncHandler(async (req, res) => { await hotelService.deleteHotel(req.params.id); res.status(204).send(); });

const listRooms = asyncHandler(async (req, res) => sendSuccess(res, await hotelService.listRoomsForHotel(req.params.hotelId)));
const createRoom = asyncHandler(async (req, res) => sendSuccess(res, await hotelService.createRoom(req.params.hotelId, req.body), 201));
const updateRoom = asyncHandler(async (req, res) => sendSuccess(res, await hotelService.updateRoom(req.params.id, req.body)));
const removeRoom = asyncHandler(async (req, res) => { await hotelService.deleteRoom(req.params.id); res.status(204).send(); });

const addRoomParticipant = asyncHandler(async (req, res) => sendSuccess(res, await hotelService.addRoomParticipant(req.params.roomId, req.body), 201));
const updateRoomParticipant = asyncHandler(async (req, res) => sendSuccess(res, await hotelService.updateRoomParticipant(req.params.roomId, req.params.participantId, req.body)));
const removeRoomParticipant = asyncHandler(async (req, res) => { await hotelService.removeRoomParticipant(req.params.roomId, req.params.participantId); res.status(204).send(); });

module.exports = {
  listHotels, createHotel, getHotel, updateHotel, removeHotel,
  listRooms, createRoom, updateRoom, removeRoom,
  addRoomParticipant, updateRoomParticipant, removeRoomParticipant,
};
