/**
 * Application route constants
 * Single source of truth for all frontend routes
 */
export const ROUTES = {
  // Public
  LOGIN: '/login',

  // Shared (all authenticated roles)
  DASHBOARD: '/dashboard',
  TIMESHEETS: '/timesheets',
  TIMESHEET_DETAIL: '/timesheets/:id',
  PROJECTS: '/projects',
  ALLOCATIONS: '/allocations',
  WORK_REQUESTS: '/work-requests',
  REPORTS: '/reports',

  // Resource Manager only
  USERS: '/users',
  HOLIDAYS: '/holidays',
  SKILLS: '/skills',

  // Helpers
  ROOT: '/',
};

/**
 * Build a route with params
 * e.g. buildRoute(ROUTES.TIMESHEET_DETAIL, { id: 5 }) => '/timesheets/5'
 */
export const buildRoute = (route, params = {}) => {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, value),
    route
  );
};
