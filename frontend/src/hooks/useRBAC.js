import { useAuthStore } from '../store/authStore';
import { ROLES } from '../constants';

const PERMISSIONS = {
  [ROLES.RESOURCE_MANAGER]: [
    'create:project', 'edit:project', 'archive:project',
    'manage:holidays', 'manage:skills', 'manage:users',
    'view:org-reports', 'view:org-dashboard',
    'approve:timesheet', 'approve:exception',
    'view:all-timesheets', 'manage:allocation',
  ],
  [ROLES.PROJECT_MANAGER]: [
    'manage:team', 'manage:allocation',
    'approve:timesheet', 'approve:exception',
    'view:team-dashboard', 'view:team-timesheets',
  ],
  [ROLES.EMPLOYEE]: [
    'submit:timesheet', 'raise:exception',
    'view:own-dashboard', 'view:own-timesheets',
  ],
};

export const useRBAC = () => {
  const { user } = useAuthStore();
  const role = user?.role ?? null;

  const can = (permission) => {
    if (!role) return false;
    return PERMISSIONS[role]?.includes(permission) ?? false;
  };

  return {
    can,
    role,
    isRM:       role === ROLES.RESOURCE_MANAGER,
    isPM:       role === ROLES.PROJECT_MANAGER,
    isEmployee: role === ROLES.EMPLOYEE,
  };
};
