export * from './routes';
export * from './api';

// Roles
export const ROLES = {
  RESOURCE_MANAGER: 'RESOURCE_MANAGER',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  EMPLOYEE: 'EMPLOYEE',
};

// Timesheet statuses
export const TIMESHEET_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

// Exception / Work Request types
export const EXCEPTION_TYPES = [
  { value: 'WEEKEND', label: 'Weekend Work', desc: 'Log hours on Saturday or Sunday', icon: '📅' },
  { value: 'HOLIDAY', label: 'Holiday Work', desc: 'Log hours on a company holiday', icon: '🏖️' },
  { value: 'BACKDATE', label: 'Backdated Entry', desc: 'Log hours more than 2 weeks in the past', icon: '🕐' },
  { value: 'ALLOCATION_BREACH', label: 'Allocation Breach', desc: 'Log hours beyond your allocated limit', icon: '⚡' },
];

// Status badge color map
export const STATUS_COLORS = {
  DRAFT: 'badge-gray',
  SUBMITTED: 'badge-blue',
  APPROVED: 'badge-green',
  REJECTED: 'badge-red',
  PENDING: 'badge-yellow',
  ACTIVE: 'badge-green',
  ARCHIVED: 'badge-gray',
};

// Validation limits
export const VALIDATION = {
  MAX_HOURS_PER_DAY: 12,
  MAX_DAYS_PAST: 14,
  MAX_DAYS_FUTURE: 7,
};
