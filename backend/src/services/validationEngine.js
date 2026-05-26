const { isWeekend, differenceInCalendarDays, startOfDay, isWithinInterval } = require('date-fns');
const prisma = require('../config/database');
const { MAX_HOURS_PER_DAY, MAX_DAYS_PAST, MAX_DAYS_FUTURE, EXCEPTION_TYPE, REQUEST_STATUS } = require('../utils/constants');

/**
 * Validate a single timesheet entry in isolation (used for real-time checks).
 * excludeTimesheetId: exclude all entries from this timesheet when checking daily total
 *                     (so we don't double-count entries from the same timesheet being saved)
 */
async function validateTimesheetEntry({ employeeId, projectId, entryDate, hours, excludeTimesheetId = null }) {
  const errors = [];

  if (!hours || hours <= 0) {
    errors.push('Hours must be greater than 0');
    return { valid: false, errors };
  }

  const date  = startOfDay(new Date(entryDate));
  const today = startOfDay(new Date());

  // Rule 1: Date range restriction
  const daysDiff = differenceInCalendarDays(today, date);
  if (daysDiff > MAX_DAYS_PAST) {
    errors.push(`Entry date is more than ${MAX_DAYS_PAST} days in the past`);
  }
  if (daysDiff < -MAX_DAYS_FUTURE) {
    errors.push(`Entry date is more than ${MAX_DAYS_FUTURE} days in the future`);
  }

  // Rule 2: Weekend restriction
  if (isWeekend(date)) {
    const approved = await prisma.exceptionRequest.findFirst({
      where: { employeeId, requestDate: date, requestType: EXCEPTION_TYPE.WEEKEND, status: REQUEST_STATUS.APPROVED },
    });
    if (!approved) errors.push('Weekend entries require an approved exception request');
  }

  // Rule 3: Holiday restriction
  const holiday = await prisma.holiday.findFirst({ where: { holidayDate: date } });
  if (holiday) {
    const approved = await prisma.exceptionRequest.findFirst({
      where: { employeeId, requestDate: date, requestType: EXCEPTION_TYPE.HOLIDAY, status: REQUEST_STATUS.APPROVED },
    });
    if (!approved) errors.push(`${holiday.holidayName} is a company holiday. Raise an exception request to log hours.`);
  }

  // Rule 4: Max 12h/day — exclude entries from the current timesheet being saved
  const dayTotal = await prisma.timesheetEntry.aggregate({
    where: {
      entryDate: date,
      timesheet: {
        employeeId,
        ...(excludeTimesheetId && { id: { not: excludeTimesheetId } }),
      },
    },
    _sum: { hours: true },
  });
  const existingHours = dayTotal._sum.hours ?? 0;
  if (existingHours + hours > MAX_HOURS_PER_DAY) {
    errors.push(
      `Total hours on ${date.toISOString().slice(0, 10)} would exceed ${MAX_HOURS_PER_DAY}h ` +
      `(already ${existingHours}h logged in other timesheets, trying to add ${hours}h)`
    );
  }

  // Rule 5: Allocation check
  if (projectId) {
    const allocation = await prisma.allocation.findFirst({ where: { employeeId, projectId } });
    if (!allocation) {
      errors.push('No active allocation found for this project');
    } else {
      // Rule 5a: Date within allocation window
      const windowStart = startOfDay(new Date(allocation.startDate));
      const windowEnd   = startOfDay(new Date(allocation.endDate));
      if (!isWithinInterval(date, { start: windowStart, end: windowEnd })) {
        errors.push(
          `Entry date is outside the permissible allocation window ` +
          `(${windowStart.toISOString().slice(0, 10)} – ${windowEnd.toISOString().slice(0, 10)})`
        );
      }

      // Rule 5b: Total hours vs allocated hours (exclude current timesheet to avoid double-count)
      const usedHours = await prisma.timesheetEntry.aggregate({
        where: {
          projectId,
          timesheet: {
            employeeId,
            ...(excludeTimesheetId && { id: { not: excludeTimesheetId } }),
          },
        },
        _sum: { hours: true },
      });
      const used = usedHours._sum.hours ?? 0;
      if (used + hours > allocation.allocatedHours) {
        const breachException = await prisma.exceptionRequest.findFirst({
          where: { employeeId, projectId, requestType: EXCEPTION_TYPE.ALLOCATION_BREACH, status: REQUEST_STATUS.APPROVED },
        });
        if (!breachException) {
          errors.push(
            `Exceeds allocated hours (${allocation.allocatedHours}h total, ${used}h used in other timesheets, trying to add ${hours}h)`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate all entries in a timesheet before submission.
 *
 * Strategy:
 * 1. Per-day: sum all hours for each date within THIS timesheet,
 *    then check the total doesn't exceed 12h (no cross-timesheet double-count).
 * 2. Per-entry: check date range, weekend, holiday, allocation window.
 * 3. Per-project: check total allocated hours across ALL timesheets
 *    (excluding this one, then adding this timesheet's total for that project).
 */
async function validateTimesheetForSubmission(timesheetId) {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: { entries: true },
  });
  if (!timesheet) throw new Error('Timesheet not found');

  const { employeeId, entries } = timesheet;
  const allErrors = [];

  // Group entries by date for daily total check
  const byDate = {};
  for (const entry of entries) {
    const ds = startOfDay(new Date(entry.entryDate)).toISOString();
    if (!byDate[ds]) byDate[ds] = [];
    byDate[ds].push(entry);
  }

  // Rule 4: Check daily totals WITHIN this timesheet
  for (const [ds, dayEntries] of Object.entries(byDate)) {
    const dayTotal = dayEntries.reduce((s, e) => s + e.hours, 0);
    if (dayTotal > MAX_HOURS_PER_DAY) {
      allErrors.push({
        entryId: dayEntries[0].id,
        entryDate: dayEntries[0].entryDate,
        errors: [`Total hours on ${ds.slice(0, 10)} is ${dayTotal}h which exceeds the ${MAX_HOURS_PER_DAY}h daily limit`],
      });
    }
  }

  // Per-entry: date range, weekend, holiday, allocation window + allocation total
  for (const entry of entries) {
    const result = await validateTimesheetEntry({
      employeeId,
      projectId:          entry.projectId,
      entryDate:          entry.entryDate,
      hours:              entry.hours,
      excludeTimesheetId: timesheetId, // exclude THIS timesheet from cross-timesheet checks
    });

    // Filter out Rule 4 errors (already handled above per-day)
    const filteredErrors = result.errors.filter((e) => !e.includes('would exceed') && !e.includes('exceed'));

    if (filteredErrors.length > 0) {
      allErrors.push({ entryId: entry.id, entryDate: entry.entryDate, errors: filteredErrors });
    }
  }

  // Deduplicate errors by entryId
  const seen = new Set();
  const dedupedErrors = allErrors.filter((e) => {
    if (seen.has(e.entryId)) return false;
    seen.add(e.entryId);
    return true;
  });

  return { valid: dedupedErrors.length === 0, entryErrors: dedupedErrors };
}

module.exports = { validateTimesheetEntry, validateTimesheetForSubmission };
