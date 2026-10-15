// Route ids are PostgreSQL INTEGERs. Anything else ("abc", "1.5", beyond
// INT range) can't exist, so pages show "not found" without calling the
// API.
const MAX_INT4 = 2147483647;

export function isValidId(id) {
  return /^\d+$/.test(String(id)) && Number(id) > 0 && Number(id) <= MAX_INT4;
}
