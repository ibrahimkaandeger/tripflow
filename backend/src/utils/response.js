// Standard response envelope for the Business API (Phase: Business
// API). Legacy routes (users/trips/trip-days/activities) keep their
// existing flat { success, message, ... } shape untouched -- these
// helpers are only used by the new business modules.

function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function sendList(res, data, pagination) {
  return res.status(200).json({ success: true, data, pagination });
}

module.exports = { sendSuccess, sendList };
