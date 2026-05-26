import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { ROUTES } from '../constants/routes';
import { API } from '../constants/api';

/**
 * PrivateRoute — guards all authenticated pages.
 *
 * On first render (e.g. page reload), if there is no in-memory accessToken,
 * we attempt a silent refresh using the HttpOnly refreshToken cookie.
 * This restores the session without requiring the user to log in again.
 *
 * States:
 *   checking  — waiting for the silent refresh attempt to complete (shows nothing)
 *   authed    — accessToken is in memory, render children
 *   unauthed  — no valid session, redirect to login
 */
export default function PrivateRoute() {
  const { isAuthenticated, accessToken, setAuth } = useAuthStore();
  const [checking, setChecking] = useState(!isAuthenticated);

  useEffect(() => {
    // Already authenticated in memory — nothing to do
    if (isAuthenticated && accessToken) {
      setChecking(false);
      return;
    }

    // Attempt silent refresh using the HttpOnly cookie
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.post(
          API.AUTH.REFRESH,
          {},
          { withCredentials: true }
        );
        if (!cancelled) {
          // Fetch the current user profile with the new token
          const meRes = await axios.get(API.AUTH.ME, {
            withCredentials: true,
            headers: { Authorization: `Bearer ${data.data.accessToken}` },
          });
          setAuth(meRes.data.data, data.data.accessToken);
        }
      } catch {
        // No valid cookie or refresh failed — user must log in
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    // Render nothing while we check — avoids a flash redirect to /login
    return null;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
}
