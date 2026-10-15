// Mirrors the tours_status_check constraint in the backend.
export const TOUR_STATUS_LABELS = {
  DRAFT: "Taslak",
  PLANNED: "Planlandı",
  CONFIRMED: "Kesinleşti",
  ONGOING: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

// Unknown values fall back to the raw status instead of crashing.
export function tourStatusLabel(status) {
  return TOUR_STATUS_LABELS[status] || status || "-";
}

export const TOUR_STATUS_TONES = {
  DRAFT: "neutral",
  PLANNED: "blue",
  CONFIRMED: "blue",
  ONGOING: "green",
  COMPLETED: "neutral",
  CANCELLED: "red",
};

// StatusBadge-compatible { label, tone } map.
export const TOUR_STATUS = Object.fromEntries(
  Object.entries(TOUR_STATUS_LABELS).map(([value, label]) => [value, { label, tone: TOUR_STATUS_TONES[value] }])
);
