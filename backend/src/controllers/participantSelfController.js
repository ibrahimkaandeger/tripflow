const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const AppError = require("../utils/AppError");
const service = require("../services/participantSelfService");

const listMyTours = asyncHandler(async (req, res) => sendSuccess(res, await service.getMyTours(req.user.id)));
const getProgram = asyncHandler(async (req, res) => sendSuccess(res, await service.getMyTourProgram(req.participantScope.tourId)));
const getFlights = asyncHandler(async (req, res) => sendSuccess(res, await service.getMyTourFlights(req.participantScope.tourId, req.participantScope.participantId)));
const getHotels = asyncHandler(async (req, res) => sendSuccess(res, await service.getMyTourHotels(req.participantScope.tourId, req.participantScope.participantId)));
const getAnnouncements = asyncHandler(async (req, res) => sendSuccess(res, await service.getMyTourAnnouncements(req.participantScope.tourId)));
const getDocuments = asyncHandler(async (req, res) => sendSuccess(res, await service.getMyTourDocuments(req.participantScope.tourId, req.participantScope.participantId)));
const getPayments = asyncHandler(async (req, res) => sendSuccess(res, await service.getMyTourPayments(req.participantScope.tourId, req.participantScope.participantId)));

const getDocumentById = asyncHandler(async (req, res) => {
  const doc = await service.getMyDocumentById(req.participantScope.tourId, req.participantScope.participantId, req.params.documentId);
  if (!doc) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Belge bulunamadı.");
  }
  sendSuccess(res, doc);
});

module.exports = {
  listMyTours, getProgram, getFlights, getHotels, getAnnouncements, getDocuments, getDocumentById, getPayments,
};
