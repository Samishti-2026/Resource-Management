import { format, startOfWeek, endOfWeek, addDays, isWeekend, parseISO } from 'date-fns';

export const getWeekStart = (date = new Date()) => {
  return startOfWeek(new Date(date), { weekStartsOn: 1 });
};

export const getWeekEnd = (date = new Date()) => {
  return endOfWeek(new Date(date), { weekStartsOn: 1 });
};

export const getWeekDays = (weekStart) => {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const formatDate = (date, fmt = 'dd MMM yyyy') => {
  if (!date) return '';
  return format(new Date(date), fmt);
};

export const formatDateInput = (date) => {
  if (!date) return '';
  return format(new Date(date), 'yyyy-MM-dd');
};

export const isWeekendDay = (date) => isWeekend(new Date(date));

export const getDayName = (date) => format(new Date(date), 'EEE');

export const getWeekLabel = (weekStart) => {
  const start = new Date(weekStart);
  const end = addDays(start, 6);
  return `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}`;
};
