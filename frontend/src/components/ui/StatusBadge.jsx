const TONE_CLASS = {
  blue: "badge badge-blue",
  green: "badge badge-green",
  orange: "badge badge-orange",
  red: "badge badge-red",
  neutral: "badge",
};

// Renders an enum value from one of the maps in utils/labels.js.
// Unknown values are shown raw in a neutral badge.
function StatusBadge({ map, value }) {
  const entry = map?.[value];
  const label = entry ? (typeof entry === "string" ? entry : entry.label) : value || "-";
  const tone = entry && typeof entry === "object" ? entry.tone : "neutral";
  return <span className={TONE_CLASS[tone] || TONE_CLASS.neutral}>{label}</span>;
}

export default StatusBadge;
