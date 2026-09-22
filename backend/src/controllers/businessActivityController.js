const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const activityService = require("../services/businessActivityService");

const list = asyncHandler(async (req, res) => {
  sendSuccess(res, await activityService.listActivitiesForTourDay(req.params.dayId));
});

const create = asyncHandler(async (req, res) => {
  sendSuccess(res, await activityService.createActivity(req.params.dayId, req.body), 201);
});

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, await activityService.updateActivity(req.params.id, req.body));
});

const remove = asyncHandler(async (req, res) => {
  await activityService.deleteActivity(req.params.id);
  res.status(204).send();
});

module.exports = { list, create, update, remove };
