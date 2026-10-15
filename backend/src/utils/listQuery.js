const { requireIntId, requireEnum, fail } = require("./validate");
const { parsePagination } = require("./pagination");

// Validates the filters shared by the company-wide list endpoints
// (GET /flights, /hotels, /activities, /documents, /announcements) so
// bad input is a 400 instead of a Postgres cast error. Returns the
// parsed values; callers build their own WHERE clauses from them.
function parseListQuery(query, { statuses } = {}) {
  for (const key of ["tour", "page", "limit"]) {
    if (query[key] !== undefined && query[key] !== "") requireIntId(query[key], key);
  }

  if (query.status) {
    if (!statuses) fail("status filtresi bu liste için desteklenmiyor.");
    requireEnum(query.status, statuses, "status");
  }

  let search = null;
  if (query.search !== undefined && query.search !== "") {
    if (typeof query.search !== "string" || query.search.length > 100) {
      fail("search en fazla 100 karakterlik tek bir metin olmalı.");
    }
    search = `%${query.search.trim()}%`;
  }

  return {
    ...parsePagination(query),
    tourId: query.tour ? Number(query.tour) : null,
    status: query.status || null,
    search,
  };
}

module.exports = { parseListQuery };
