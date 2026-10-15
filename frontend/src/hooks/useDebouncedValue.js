import { useEffect, useState } from "react";

// `value`, but only after it has stopped changing for `delay` ms. Used so
// a search box doesn't fire a request on every keystroke.
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
