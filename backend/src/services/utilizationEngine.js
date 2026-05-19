const prisma = require('../config/database');

/**
 * Calculate utilization % for an employee in a date range
 */
async function getEmployeeUtilization(employeeId, from, to) {
  const [allocations, submittedHours] = await Promise.all([
    prisma.allocation.findMany({
      where: {
        employeeId,
        periodStart: { lte: to },
        periodEnd: { gte: from },
      },
    }),
    prisma.timesheetEntry.aggregate({
      where: {
        timesheet: {
          employeeId,
          status: { in: ['SUBMITTED', 'APPROVED'] },
        },
        entryDate: { gte: from, lte: to },
      },
      _sum: { hours: true },
    }),
  ]);

  const allocatedHours = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
  const usedHours = submittedHours._sum.hours ?? 0;
  const utilizationPct = allocatedHours > 0 ? Math.round((usedHours / allocatedHours) * 100) : 0;

  return { allocatedHours, usedHours, utilizationPct };
}

/**
 * Get project utilization
 */
async function getProjectUtilization(projectId, from, to) {
  const [allocations, usedHours] = await Promise.all([
    prisma.allocation.aggregate({
      where: {
        projectId,
        periodStart: { lte: to },
        periodEnd: { gte: from },
      },
      _sum: { allocatedHours: true },
    }),
    prisma.timesheetEntry.aggregate({
      where: {
        projectId,
        entryDate: { gte: from, lte: to },
        timesheet: { status: { in: ['SUBMITTED', 'APPROVED'] } },
      },
      _sum: { hours: true },
    }),
  ]);

  const allocated = allocations._sum.allocatedHours ?? 0;
  const used = usedHours._sum.hours ?? 0;
  const pct = allocated > 0 ? Math.round((used / allocated) * 100) : 0;

  return { allocatedHours: allocated, usedHours: used, utilizationPct: pct };
}

module.exports = { getEmployeeUtilization, getProjectUtilization };
