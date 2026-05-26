/**
 * API endpoint constants
 * All backend endpoints in one place
 */
export const API_BASE = '/api/v1';

export const API = {
  // Auth
  AUTH: {
    LOGIN: `${API_BASE}/auth/login`,
    REFRESH: `${API_BASE}/auth/refresh`,
    LOGOUT: `${API_BASE}/auth/logout`,
    ME: `${API_BASE}/auth/me`,
  },

  // Users
  USERS: {
    BASE: `${API_BASE}/users`,
    BY_ID: (id) => `${API_BASE}/users/${id}`,
    SKILLS: (id) => `${API_BASE}/users/${id}/skills`,
    ROLES: `${API_BASE}/users/roles`,
  },

  // Projects
  PROJECTS: {
    BASE: `${API_BASE}/projects`,
    BY_ID: (id) => `${API_BASE}/projects/${id}`,
    ARCHIVE: (id) => `${API_BASE}/projects/${id}/archive`,
    MEMBERS: (id) => `${API_BASE}/projects/${id}/members`,
    MEMBER: (id, uid) => `${API_BASE}/projects/${id}/members/${uid}`,
  },

  // Allocations
  ALLOCATIONS: {
    BASE: `${API_BASE}/allocations`,
    BY_ID: (id) => `${API_BASE}/allocations/${id}`,
  },

  // Timesheets
  TIMESHEETS: {
    BASE: `${API_BASE}/timesheets`,
    BY_ID: (id) => `${API_BASE}/timesheets/${id}`,
    SUBMIT: (id) => `${API_BASE}/timesheets/${id}/submit`,
    APPROVE: (id) => `${API_BASE}/timesheets/${id}/approve`,
    REJECT: (id) => `${API_BASE}/timesheets/${id}/reject`,
    COPY_PREVIOUS: (id) => `${API_BASE}/timesheets/${id}/copy-previous`,
  },

  // Exceptions / Work Requests
  EXCEPTIONS: {
    BASE: `${API_BASE}/exceptions`,
    BY_ID: (id) => `${API_BASE}/exceptions/${id}`,
    APPROVE: (id) => `${API_BASE}/exceptions/${id}/approve`,
    REJECT: (id) => `${API_BASE}/exceptions/${id}/reject`,
  },

  // Holidays
  HOLIDAYS: {
    BASE:   `${API_BASE}/holidays`,
    BULK:   `${API_BASE}/holidays/bulk`,
    UPLOAD: `${API_BASE}/holidays/upload`,
    BY_ID:  (id) => `${API_BASE}/holidays/${id}`,
  },

  // Skills
  SKILLS: {
    BASE: `${API_BASE}/skills`,
    BY_ID: (id) => `${API_BASE}/skills/${id}`,
  },

  // Dashboard
  DASHBOARD: {
    EMPLOYEE: `${API_BASE}/dashboard/employee`,
    PM: `${API_BASE}/dashboard/pm`,
    RM: `${API_BASE}/dashboard/rm`,
  },

  // Reports
  REPORTS: {
    EMPLOYEE: (id) => `${API_BASE}/reports/employee/${id}`,
    PROJECT: (id) => `${API_BASE}/reports/project/${id}`,
    UTILIZATION: `${API_BASE}/reports/utilization`,
  },

  // Health
  HEALTH: `${API_BASE.replace('/v1', '')}/health`,
};
