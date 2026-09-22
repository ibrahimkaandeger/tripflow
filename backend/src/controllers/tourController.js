const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendList } = require("../utils/response");
const tourService = require("../services/tourService");

const list = asyncHandler(async (req, res) => {
  const { data, pagination } = await tourService.listTours(req.membership.companyId, req.query);
  sendList(res, data, pagination);
});

const getById = asyncHandler(async (req, res) => {
  const tour = await tourService.getTourById(req.membership.companyId, req.params.id);
  sendSuccess(res, tour);
});

const create = asyncHandler(async (req, res) => {
  const tour = await tourService.createTour(req.membership.companyId, req.user.id, req.body);
  sendSuccess(res, tour, 201);
});

const update = asyncHandler(async (req, res) => {
  const tour = await tourService.updateTour(req.membership.companyId, req.params.id, req.body);
  sendSuccess(res, tour);
});

const remove = asyncHandler(async (req, res) => {
  await tourService.deleteTour(req.membership.companyId, req.params.id);
  res.status(204).send();
});

module.exports = { list, getById, create, update, remove };
