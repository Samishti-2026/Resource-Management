import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { API } from '../constants/api';

/**
 * Axios instance — base API client.
 *
 * Security notes:
 *   - withCredentials: true  → browser sends the HttpOnly refreshToken cookie
 *                              on every request to the same origin automatically.
 *   - accessToken is read from in-memory Zustand store only (never localStorage).
 *   - No token is ever written to localStorage or sessionStorage.
 */
const api = axios.create({
  baseURL:         '/',
  withCredentials: true,   // required for HttpOnly cookie to be sent
  headers:         { 'Content-Type': 'application/json' },
  timeout:         30000,
});

// ── Request interceptor — attach in-memory access token ──────────────────────
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle 401 → silent token refresh → retry ─────────
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else       prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, and only once per request
    if (error.response?.status === 401 && !originalRequest._retry) {

      // If a refresh is already in flight, queue this request until it resolves
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // POST to /auth/refresh — no body needed.
        // The HttpOnly refreshToken cookie is sent automatically by the browser
        // because withCredentials: true is set on the instance.
        const { data } = await axios.post(API.AUTH.REFRESH, {}, { withCredentials: true });
        const newToken = data.data.accessToken;

        useAuthStore.getState().setAccessToken(newToken);
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear auth state and redirect to login
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
