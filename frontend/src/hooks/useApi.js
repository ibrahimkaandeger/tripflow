import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { describeApiError } from "../utils/apiError";

// Runs `request` (a function returning an apiClient promise) whenever
// `key` changes and exposes { data, loading, error, reload }. `data` is
// the response body. Pass `key = null` to skip the request. Results that
// arrive after the key changed (or the component unmounted) are ignored,
// so a slow earlier request can never overwrite a newer one.
export function useApi(request, key, { notFound } = {}) {
  const [version, setVersion] = useState(0);
  const requestKey = key === null ? null : `${key}#${version}`;
  const [state, setState] = useState({ key: null, data: null, error: "" });

  // `request` is a new closure every render; keep the latest one in a
  // ref (updated before effects run) so only a key change refetches.
  const requestRef = useRef(request);
  useLayoutEffect(() => {
    requestRef.current = request;
  });

  useEffect(() => {
    if (requestKey === null) return undefined;
    let ignore = false;

    requestRef
      .current()
      .then((response) => {
        if (!ignore) setState({ key: requestKey, data: response.data, error: "" });
      })
      .catch((error) => {
        if (!ignore) setState({ key: requestKey, data: null, error: describeApiError(error, { notFound }) });
      });

    return () => {
      ignore = true;
    };
  }, [requestKey, notFound]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const loading = requestKey !== null && state.key !== requestKey;

  return {
    // Previous data stays visible while a reload is in flight.
    data: state.data,
    loading,
    error: loading ? "" : state.error,
    reload,
  };
}
