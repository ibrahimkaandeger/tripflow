// pg serializes DATE columns as local midnight converted to UTC (e.g.
// 2026-10-01 -> "2026-09-30T21:00:00.000Z"), so formatting back through
// the local timezone restores the intended calendar date.
export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
}

export function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const pad = (n) => String(n).padStart(2, "0");

// Value for <input type="date"> from an API DATE (same local-timezone
// reasoning as formatDate): "2026-09-30T21:00:00.000Z" -> "2026-10-01".
export function toInputDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Value for <input type="datetime-local"> from an API TIMESTAMP. The
// backend stores flight times as local wall-clock time, and pg sends
// them as that local time converted to UTC, so reading them back in
// local time gives the stored wall-clock value.
export function toInputDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${toInputDate(value)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Local calendar date as YYYY-MM-DD (not UTC-shifted).
export function todayInputDate() {
  return toInputDate(new Date());
}

// "HH:MM:SS" (TIME column) -> "HH:MM".
export function formatTime(value) {
  return typeof value === "string" ? value.slice(0, 5) : "";
}
