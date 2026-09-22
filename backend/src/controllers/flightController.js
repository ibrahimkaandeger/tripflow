const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const flightService = require("../services/flightService");

const list = asyncHandler(async (req, res) => sendSuccess(res, await flightService.listFlightsForTour(req.params.tourId)));
const create = asyncHandler(async (req, res) => sendSuccess(res, await flightService.createFlight(req.params.tourId, req.body), 201));
const getById = asyncHandler(async (req, res) => sendSuccess(res, await flightService.getFlightById(req.params.id)));
const update = asyncHandler(async (req, res) => sendSuccess(res, await flightService.updateFlight(req.params.id, req.body)));
const remove = asyncHandler(async (req, res) => { await flightService.deleteFlight(req.params.id); res.status(204).send(); });

const addParticipant = asyncHandler(async (req, res) => sendSuccess(res, await flightService.addFlightParticipant(req.params.flightId, req.body), 201));
const updateParticipant = asyncHandler(async (req, res) => sendSuccess(res, await flightService.updateFlightParticipant(req.params.flightId, req.params.participantId, req.body)));
const removeParticipant = asyncHandler(async (req, res) => { await flightService.removeFlightParticipant(req.params.flightId, req.params.participantId); res.status(204).send(); });

module.exports = { list, create, getById, update, remove, addParticipant, updateParticipant, removeParticipant };
