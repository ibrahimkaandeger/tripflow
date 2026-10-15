import apiClient from "../services/apiClient";
import { useApi } from "./useApi";

// Tours for <select> inputs (newest first). The API caps a page at 100;
// that covers the active tours of a typical operator.
export function useTourOptions() {
  const { data, loading, error } = useApi(() => apiClient.get("/tours", { params: { limit: 100 } }), "tour-options");
  return { tours: data?.data || [], loading, error };
}
