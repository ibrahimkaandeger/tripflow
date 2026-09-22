const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const announcementService = require("../services/announcementService");

const list = asyncHandler(async (req, res) => sendSuccess(res, await announcementService.listAnnouncementsForTour(req.params.tourId)));
const getById = asyncHandler(async (req, res) => sendSuccess(res, await announcementService.getAnnouncementById(req.params.id)));
const create = asyncHandler(async (req, res) => sendSuccess(res, await announcementService.createAnnouncement(req.params.tourId, req.user.id, req.body), 201));
const update = asyncHandler(async (req, res) => sendSuccess(res, await announcementService.updateAnnouncement(req.params.id, req.body)));
const remove = asyncHandler(async (req, res) => { await announcementService.deleteAnnouncement(req.params.id); res.status(204).send(); });
const publish = asyncHandler(async (req, res) => sendSuccess(res, await announcementService.publishAnnouncement(req.params.id)));

const markRead = asyncHandler(async (req, res) => sendSuccess(res, await announcementService.markAnnouncementRead(req.user.id, req.params.id)));
const unread = asyncHandler(async (req, res) => sendSuccess(res, await announcementService.listUnreadAnnouncements(req.user.id)));

module.exports = { list, getById, create, update, remove, publish, markRead, unread };
