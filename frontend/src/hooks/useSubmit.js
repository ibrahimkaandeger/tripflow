import { useState } from "react";
import { describeApiError } from "../utils/apiError";

// Busy/error state for a form submit. `run(fn)` awaits fn; a thrown API
// error becomes a readable message and `run` resolves to false so the
// caller can keep the form open.
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (err) {
      setError(describeApiError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, run };
}
