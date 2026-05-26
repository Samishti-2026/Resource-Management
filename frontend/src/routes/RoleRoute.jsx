import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ROUTES } from '../constants/routes';

export default function RoleRoute({ allowedRoles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to={ROUTES.LOGIN} replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to={ROUTES.TIMESHEETS} replace />;
  return <Outlet />;
}
