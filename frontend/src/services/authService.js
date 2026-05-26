import api from './api';
import { API } from '../constants/api';

/**
 * Login — sends credentials, receives accessToken + user in body.
 * The server sets the refreshToken as an HttpOnly cookie automatically.
 * We never touch localStorage for tokens.
 */
export const login = async (email, password) => {
  const { data } = await api.post(API.AUTH.LOGIN, { email, password });
  // data.data = { accessToken, user }
  // refreshToken is in an HttpOnly cookie — not accessible here, intentionally
  return data.data;
};

/**
 * Logout — tells the server to invalidate the refresh token cookie.
 * No localStorage cleanup needed since we never stored tokens there.
 */
export const logout = async () => {
  try {
    // withCredentials: true (set on the axios instance) ensures the cookie is sent
    await api.post(API.AUTH.LOGOUT);
  } catch {
    // Best-effort — clear local state regardless of server response
  }
};

/**
 * Fetch the current authenticated user from the server.
 */
export const getMe = async () => {
  const { data } = await api.get(API.AUTH.ME);
  return data.data;
};
