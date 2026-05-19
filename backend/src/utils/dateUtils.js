const { startOfWeek, endOfWeek, format, parseISO, isValid } = require('date-fns');

/**
 * Get the Monday of the week for a given date
 */
const getWeekStart = (date) => {
  return startOfWeek(new Date(date), { weekStartsOn: 1 });
};

/**
 * Get the Sunday of the week for a given date
 */
const getWeekEnd = (date) => {
  return endOfWeek(new Date(date), { weekStartsOn: 1 });
};

/**
 * Format date to YYYY-MM-DD string
 */
const toDateString = (date) => {
  return format(new Date(date), 'yyyy-MM-dd');
};

/**
 * Parse a date string safely
 */
const parseDate = (dateStr) => {
  const parsed = parseISO(dateStr);
  if (!isValid(parsed)) throw new Error(`Invalid date: ${dateStr}`);
  return parsed;
};

/**
 * Get all 7 days of a week starting from weekStart (Monday)
 */
const getWeekDays = (weekStart) => {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toDateString(d);
  });
};

module.exports = { getWeekStart, getWeekEnd, toDateString, parseDate, getWeekDays };
