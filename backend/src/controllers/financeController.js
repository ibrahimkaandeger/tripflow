const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendList } = require("../utils/response");
const financeService = require("../services/financeService");

const listForTour = asyncHandler(async (req, res) => {
  const { data, pagination } = await financeService.listTransactionsForTour(req.membership.companyId, req.params.tourId, req.query);
  sendList(res, data, pagination);
});

const listAll = asyncHandler(async (req, res) => {
  const { data, pagination } = await financeService.listTransactions(req.membership.companyId, req.query);
  sendList(res, data, pagination);
});

const getById = asyncHandler(async (req, res) => sendSuccess(res, await financeService.getTransactionById(req.params.id)));

const create = asyncHandler(async (req, res) => {
  const item = await financeService.createTransaction(req.membership.companyId, req.params.tourId, req.user.id, req.body);
  sendSuccess(res, item, 201);
});

const update = asyncHandler(async (req, res) => sendSuccess(res, await financeService.updateTransaction(req.params.id, req.body)));
const cancel = asyncHandler(async (req, res) => sendSuccess(res, await financeService.cancelTransaction(req.params.id)));

module.exports = { listForTour, listAll, getById, create, update, cancel };
