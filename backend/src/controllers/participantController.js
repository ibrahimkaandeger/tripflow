const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendList } = require("../utils/response");
const participantService = require("../services/participantService");
const { withoutFinanceUnlessAllowed } = require("../utils/financeVisibility");

const list = asyncHandler(async (req, res) => {
  const { data, pagination } = await participantService.listParticipants(req.membership.companyId, req.query);
  sendList(res, data, pagination);
});

const getById = asyncHandler(async (req, res) => {
  const participant = await participantService.getParticipantById(req.membership.companyId, req.params.id);
  sendSuccess(res, participant);
});

const listTours = asyncHandler(async (req, res) => {
  const tours = await participantService.listToursForParticipant(req.membership.companyId, req.params.id);
  sendSuccess(res, await withoutFinanceUnlessAllowed(req, tours));
});

const create = asyncHandler(async (req, res) => {
  const participant = await participantService.createParticipant(req.membership.companyId, req.body);
  sendSuccess(res, participant, 201);
});

const update = asyncHandler(async (req, res) => {
  const participant = await participantService.updateParticipant(req.membership.companyId, req.params.id, req.body);
  sendSuccess(res, participant);
});

const remove = asyncHandler(async (req, res) => {
  await participantService.deleteParticipant(req.membership.companyId, req.params.id);
  res.status(204).send();
});

module.exports = { list, getById, listTours, create, update, remove };
