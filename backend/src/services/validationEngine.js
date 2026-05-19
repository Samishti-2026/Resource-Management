const { isWeekend, differenceInCalendarDays, startOfDay } = require('date-fns');
const prisma = require('../config/database');
const { MAX_HOURS_PER_DAY, MAX_DAYS_PAST, MAX_DAYS_FUTURE, EXCEPTION_TYPE, REQUEST_STATUS } = require('../utils/constants');

/**
 * Central validation engine for timesheet entries.
 * Returns { valid: boolean, errors: string[] }
 */
async function validateTimesheetEntry({ employeeId, projectId, entryDate, hours, excludeEntryId = null }) {
  const errors = [];
  const date = startOfDay(new Date(entryDate));
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
      where: {
        employeeId,
        requestDate: date,
        requestType: EXCEPTION_TYPE.WEEKEND,
        status: REQUEST_STATUS.APPROVED,
      },
    });
    if (!approved) {
      errors.push('Weekend entries require an approved exception request');
    }
  }

  // Rule 3: Holiday restriction
  const holiday = await prisma.holiday.findFirst({ where: { holidayDate: date } });
  if (holiday) {
    const approved = await prisma.exceptionRequest.findFirst({
      where: {
        employeeId,
        requestDate: date,
        requestType: EXCEPTION_TYPE.HOLIDAY,
        status: REQUEST_STATUS.APPROVED,
      },
    });
    if (!approved) {
      errors.push(`${holiday.holidayName} is a company holiday. Raise an exception request to log hours.`);
    }
  }

  // Rule 4: Max 12 hours/day across all projects
  const dayTotal = await prisma.timesheetEntry.aggregate({
    where: {
      entryDate: date,
      timesheet: { employeeId },
      ...(excludeEntryId && { id: { not: excludeEntryId } }),
    },
    _sum: { hours: true },
  });
  const existingHours = dayTotal._sum.hours ?? 0;
  if (existingHours + hours > MAX_HOURS_PER_DAY) {
    errors.push(
      `Total hours on this date would exceed ${MAX_HOURS_PER_DAY}h (currently ${existingHours}h logged)`
    );
  }

  // Rule 5: Allocation limit
  if (projectId) {
    const allocation = await prisma.allocation.findFirst({
      where: { employeeId, projectId },
    });

    if (!allocation) {
      errors.push('No active allocation found for this project');
    } else {
      const usedHours = await prisma.timesheetEntry.aggregate({
        where: {
          projectId,
          timesheet: { employeeId },
          ...(excludeEntryId && { id: { not: excludeEntryId } }),
        },
        _sum: { hours: true },
      });
      const used = usedHours._sum.hours ?? 0;
      if (used + hours > allocation.allocatedHours) {
        const breachException = await prisma.exceptionRequest.findFirst({
          where: {
            employeeId,
            projectId,
            requestType: EXCEPTION_TYPE.ALLOCATION_BREACH,
            status: REQUEST_STATUS.APPROVED,
          },
        });
        if (!breachException) {
          errors.push(
            `Exceeds allocated hours (${allocation.allocatedHours}h, used ${used}h). Raise an allocation breach exception.`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate all entries in a timesheet before submission
 */
async function validateTimesheetForSubmission(timesheetId) {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: { entries: true },
  });

  if (!timesheet) throw new Error('Timesheet not found');

  const allErrors = [];
  for (const entry of timesheet.entries) {
    const result = await validateTimesheetEntry({
      employeeId: timesheet.employeeId,
      projectId: entry.projectId,
      entryDate: entry.entryDate,
      hours: entry.hours,
      excludeEntryId: entry.id,
    });
    if (!result.valid) {
      allErrors.push({ entryId: entry.id, entryDate: entry.entryDate, errors: result.errors });
    }
  }

  return { valid: allErrors.length === 0, entryErrors: allErrors };
}

module.exports = { validateTimesheetEntry, validateTimesheetForSubmission };
