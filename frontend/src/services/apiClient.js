import axios from "axios";

export const TOKEN_KEY = "tripflow_token";
export const UNAUTHORIZED_EVENT = "tripflow:unauthorized";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 20000,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// A 401 from any authenticated request means the stored token is no
// longer valid (expired, secret rotated, user deleted). AuthContext
// listens for this event and signs the user out. Login/register 401s
// are ordinary "wrong credentials" answers and are left to the form.
const AUTH_ENDPOINTS = ["/users/login", "/users/"];

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => url === path);

    if (error.response?.status === 401 && !isAuthEndpoint && localStorage.getItem(TOKEN_KEY)) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    return Promise.reject(error);
  }
);

export default apiClient;
