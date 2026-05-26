const { isWeekend, differenceInCalendarDays, startOfDay, isWithinInterval } = require('date-fns');
const prisma = require('../config/database');
const { MAX_HOURS_PER_DAY, MAX_DAYS_PAST, MAX_DAYS_FUTURE, EXCEPTION_TYPE, REQUEST_STATUS } = require('../utils/constants');

/**
 * Validate a single timesheet entry in isolation (used for real-time UI checks).
 * excludeTimesheetId: exclude entries from this timesheet when checking daily total
 *                     so we don't double-count entries from the same timesheet.
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
  if (daysDiff > MAX_DAYS_PAST)    errors.push(`Entry date is more than ${MAX_DAYS_PAST} days in the past`);
  if (daysDiff < -MAX_DAYS_FUTURE) errors.push(`Entry date is more than ${MAX_DAYS_FUTURE} days in the future`);

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

  // Rule 4: Max 12h/day across other timesheets
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
      const windowStart = startOfDay(new Date(allocation.startDate));
      const windowEnd   = startOfDay(new Date(allocation.endDate));
      if (!isWithinInterval(date, { start: windowStart, end: windowEnd })) {
        errors.push(
          `Entry date is outside the permissible allocation window ` +
          `(${windowStart.toISOString().slice(0, 10)} – ${windowEnd.toISOString().slice(0, 10)})`
        );
      }

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
 * P3-2: Validate all entries in a timesheet before submission.
 *
 * Optimised: all reference data (holidays, allocations, approved exceptions,
 * cross-timesheet daily totals, cross-timesheet project totals) is fetched in
 * a single parallel batch BEFORE the per-entry loop. Validation then runs
 * entirely in memory — no DB calls inside the loop.
 */
async function validateTimesheetForSubmission(timesheetId) {
  const timesheet = await prisma.timesheet.findUnique({
    where:   { id: timesheetId },
    include: { entries: true },
  });
  if (!timesheet) throw new Error('Timesheet not found');

  const { employeeId, entries } = timesheet;
  if (entries.length === 0) return { valid: true, entryErrors: [] };

  const today = startOfDay(new Date());

  // ── Collect unique dates and project IDs from this timesheet ─────────────
  const uniqueDates      = [...new Set(entries.map((e) => startOfDay(new Date(e.entryDate)).toISOString()))];
  const uniqueDateObjs   = uniqueDates.map((d) => new Date(d));
  const uniqueProjectIds = [...new Set(entries.map((e) => e.projectId))];

  // ── Batch-fetch all reference data in parallel ────────────────────────────
  const [
    holidays,
    allocations,
    approvedExceptions,
    crossDayTotals,
    crossProjectTotals,
  ] = await Promise.all([
    // Holidays on any of the entry dates
    prisma.holiday.findMany({
      where: { holidayDate: { in: uniqueDateObjs } },
    }),

    // Allocations for this employee on the relevant projects
    prisma.allocation.findMany({
      where: { employeeId, projectId: { in: uniqueProjectIds } },
    }),

    // All approved exceptions for this employee (weekend, holiday, allocation breach)
    prisma.exceptionRequest.findMany({
      where: {
        employeeId,
        status:      REQUEST_STATUS.APPROVED,
        requestType: { in: [EXCEPTION_TYPE.WEEKEND, EXCEPTION_TYPE.HOLIDAY, EXCEPTION_TYPE.ALLOCATION_BREACH] },
      },
    }),

    // Cross-timesheet daily totals (excluding THIS timesheet)
    prisma.timesheetEntry.groupBy({
      by:    ['entryDate'],
      where: {
        entryDate: { in: uniqueDateObjs },
        timesheet: { employeeId, id: { not: timesheetId } },
      },
      _sum: { hours: true },
    }),

    // Cross-timesheet per-project totals (excluding THIS timesheet)
    prisma.timesheetEntry.groupBy({
      by:    ['projectId'],
      where: {
        projectId: { in: uniqueProjectIds },
        timesheet: { employeeId, id: { not: timesheetId } },
      },
      _sum: { hours: true },
    }),
  ]);

  // ── Build in-memory lookup maps ───────────────────────────────────────────
  const holidayMap = Object.fromEntries(
    holidays.map((h) => [startOfDay(new Date(h.holidayDate)).toISOString(), h.holidayName])
  );

  const allocationMap = Object.fromEntries(
    allocations.map((a) => [a.projectId, a])
  );

  // Exception lookups
  const weekendExceptions = new Set(
    approvedExceptions
      .filter((e) => e.requestType === EXCEPTION_TYPE.WEEKEND)
      .map((e) => startOfDay(new Date(e.requestDate)).toISOString())
  );
  const holidayExceptions = new Set(
    approvedExceptions
      .filter((e) => e.requestType === EXCEPTION_TYPE.HOLIDAY)
      .map((e) => startOfDay(new Date(e.requestDate)).toISOString())
  );
  const breachExceptions = new Set(
    approvedExceptions
      .filter((e) => e.requestType === EXCEPTION_TYPE.ALLOCATION_BREACH)
      .map((e) => e.projectId)
  );

  const crossDayMap = Object.fromEntries(
    crossDayTotals.map((r) => [startOfDay(new Date(r.entryDate)).toISOString(), r._sum.hours ?? 0])
  );

  const crossProjectMap = Object.fromEntries(
    crossProjectTotals.map((r) => [r.projectId, r._sum.hours ?? 0])
  );

  // ── Group THIS timesheet's entries by date and project for intra-sheet sums
  const intraDateMap    = {};   // dateISO → total hours within this timesheet
  const intraProjectMap = {};   // projectId → total hours within this timesheet

  for (const entry of entries) {
    const dk = startOfDay(new Date(entry.entryDate)).toISOString();
    intraDateMap[dk]              = (intraDateMap[dk]              ?? 0) + entry.hours;
    intraProjectMap[entry.projectId] = (intraProjectMap[entry.projectId] ?? 0) + entry.hours;
  }

  // ── Rule 4: Daily limit check within this timesheet ───────────────────────
  const allErrors = [];
  const reportedDates = new Set();

  for (const [dk, dayEntries] of Object.entries(
    entries.reduce((acc, e) => {
      const k = startOfDay(new Date(e.entryDate)).toISOString();
      if (!acc[k]) acc[k] = [];
      acc[k].push(e);
      return acc;
    }, {})
  )) {
    const intraTotal = intraDateMap[dk] ?? 0;
    const crossTotal = crossDayMap[dk]  ?? 0;
    if (intraTotal + crossTotal > MAX_HOURS_PER_DAY) {
      allErrors.push({
        entryId:   dayEntries[0].id,
        entryDate: dayEntries[0].entryDate,
        errors: [
          `Total hours on ${dk.slice(0, 10)} is ${intraTotal + crossTotal}h which exceeds the ${MAX_HOURS_PER_DAY}h daily limit`,
        ],
      });
      reportedDates.add(dk);
    }
  }

  // ── Per-entry rules (date range, weekend, holiday, allocation) ────────────
  for (const entry of entries) {
    const entryErrors = [];
    const date = startOfDay(new Date(entry.entryDate));
    const dk   = date.toISOString();

    // Rule 1: Date range
    const daysDiff = differenceInCalendarDays(today, date);
    if (daysDiff > MAX_DAYS_PAST)    entryErrors.push(`Entry date is more than ${MAX_DAYS_PAST} days in the past`);
    if (daysDiff < -MAX_DAYS_FUTURE) entryErrors.push(`Entry date is more than ${MAX_DAYS_FUTURE} days in the future`);

    // Rule 2: Weekend
    if (isWeekend(date) && !weekendExceptions.has(dk)) {
      entryErrors.push('Weekend entries require an approved exception request');
    }

    // Rule 3: Holiday
    if (holidayMap[dk] && !holidayExceptions.has(dk)) {
      entryErrors.push(`${holidayMap[dk]} is a company holiday. Raise an exception request to log hours.`);
    }

    // Rule 5: Allocation
    const allocation = allocationMap[entry.projectId];
    if (!allocation) {
      entryErrors.push('No active allocation found for this project');
    } else {
      // Rule 5a: Date within allocation window
      const windowStart = startOfDay(new Date(allocation.startDate));
      const windowEnd   = startOfDay(new Date(allocation.endDate));
      if (!isWithinInterval(date, { start: windowStart, end: windowEnd })) {
        entryErrors.push(
          `Entry date is outside the permissible allocation window ` +
          `(${windowStart.toISOString().slice(0, 10)} – ${windowEnd.toISOString().slice(0, 10)})`
        );
      }

      // Rule 5b: Allocation hours breach
      const crossUsed  = crossProjectMap[entry.projectId]  ?? 0;
      const intraUsed  = intraProjectMap[entry.projectId]  ?? 0;
      const totalUsed  = crossUsed + intraUsed;
      if (totalUsed > allocation.allocatedHours && !breachExceptions.has(entry.projectId)) {
        entryErrors.push(
          `Exceeds allocated hours (${allocation.allocatedHours}h total, ${crossUsed}h used in other timesheets, ` +
          `${intraUsed}h in this timesheet)`
        );
      }
    }

    if (entryErrors.length > 0) {
      allErrors.push({ entryId: entry.id, entryDate: entry.entryDate, errors: entryErrors });
    }
  }

  // Deduplicate by entryId
  const seen         = new Set();
  const dedupedErrors = allErrors.filter((e) => {
    if (seen.has(e.entryId)) return false;
    seen.add(e.entryId);
    return true;
  });

  return { valid: dedupedErrors.length === 0, entryErrors: dedupedErrors };
}

module.exports = { validateTimesheetEntry, validateTimesheetForSubmission };
