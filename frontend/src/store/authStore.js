import { create } from 'zustand';

/**
 * Auth store — intentionally NOT persisted to localStorage.
 *
 * Security rationale:
 *   - accessToken is kept in memory only. It is never written to localStorage
 *     or sessionStorage, making it inaccessible to XSS attacks.
 *   - refreshToken is stored in an HttpOnly cookie set by the server.
 *     It is never accessible from JavaScript.
 *   - On page reload the user will be re-authenticated automatically via the
 *     /auth/refresh endpoint (cookie is sent automatically by the browser).
 */
export const useAuthStore = create((set, get) => ({
  user:            null,
  accessToken:     null,
  isAuthenticated: false,

  setAuth: (user, accessToken) => {
    set({ user, accessToken, isAuthenticated: true });
  },

  setAccessToken: (accessToken) => {
    set({ accessToken });
  },

  logout: () => {
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  getRole: () => get().user?.role || null,
}));
