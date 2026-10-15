// Turns a form's string state into an API payload. Strings are trimmed;
// an empty optional field is omitted when creating and sent as null when
// editing (so clearing a field in the form really clears it).
export function toPayload(values, { editing = false } = {}) {
  const payload = {};
  for (const [key, raw] of Object.entries(values)) {
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value === "" || value === undefined) {
      if (editing) payload[key] = null;
      continue;
    }
    payload[key] = value;
  }
  return payload;
}

