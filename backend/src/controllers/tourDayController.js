const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const tourDayService = require("../services/tourDayService");

const list = asyncHandler(async (req, res) => {
  sendSuccess(res, await tourDayService.listTourDays(req.params.tourId));
});

const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, await tourDayService.getTourDayById(req.params.tourId, req.params.dayId));
});

const create = asyncHandler(async (req, res) => {
  sendSuccess(res, await tourDayService.createTourDay(req.params.tourId, req.body), 201);
});

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, await tourDayService.updateTourDay(req.params.tourId, req.params.dayId, req.body));
});

const remove = asyncHandler(async (req, res) => {
  await tourDayService.deleteTourDay(req.params.tourId, req.params.dayId);
  res.status(204).send();
});

module.exports = { list, getById, create, update, remove };
