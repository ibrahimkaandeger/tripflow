const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const documentService = require("../services/documentService");

const list = asyncHandler(async (req, res) => sendSuccess(res, await documentService.listDocumentsForTour(req.params.tourId)));
const getById = asyncHandler(async (req, res) => sendSuccess(res, await documentService.getDocumentById(req.params.id)));
const create = asyncHandler(async (req, res) => sendSuccess(res, await documentService.createDocument(req.params.tourId, req.user.id, req.body), 201));
const update = asyncHandler(async (req, res) => sendSuccess(res, await documentService.updateDocument(req.params.id, req.body)));
const remove = asyncHandler(async (req, res) => { await documentService.deleteDocument(req.params.id); res.status(204).send(); });

module.exports = { list, getById, create, update, remove };
