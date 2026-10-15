const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const tourParticipantService = require("../services/tourParticipantService");
const { withoutFinanceUnlessAllowed } = require("../utils/financeVisibility");

const list = asyncHandler(async (req, res) => {
  const data = await tourParticipantService.listTourParticipants(req.params.tourId);
  sendSuccess(res, await withoutFinanceUnlessAllowed(req, data));
});

const add = asyncHandler(async (req, res) => {
  const item = await tourParticipantService.addParticipantToTour(req.membership.companyId, req.params.tourId, req.body);
  const [visible] = await withoutFinanceUnlessAllowed(req, [item]);
  sendSuccess(res, visible, 201);
});

const update = asyncHandler(async (req, res) => {
  const item = await tourParticipantService.updateTourParticipant(req.params.tourId, req.params.participantId, req.body);
  const [visible] = await withoutFinanceUnlessAllowed(req, [item]);
  sendSuccess(res, visible);
});

const remove = asyncHandler(async (req, res) => {
  await tourParticipantService.removeParticipantFromTour(req.params.tourId, req.params.participantId);
  res.status(204).send();
});

module.exports = { list, add, update, remove };
