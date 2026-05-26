const prisma = require('../../config/database');
const { startOfMonth, endOfMonth, format, startOfWeek, subWeeks } = require('date-fns');

// ── Employee Dashboard ────────────────────────────────────────────────────────
async function getEmployeeDashboard(employeeId) {
  const now        = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);

  const [allocations, submittedEntries, pendingTimesheets, pendingExceptions, weeklyTrend, projectBreakdown] =
    await Promise.all([
      prisma.allocation.aggregate({
        where: { employeeId },
        _sum:  { allocatedHours: true },
      }),
      prisma.timesheetEntry.aggregate({
        where: {
          timesheet: { employeeId, status: { in: ['SUBMITTED', 'APPROVED'] } },
          entryDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { hours: true },
      }),
      prisma.timesheet.count({ where: { employeeId, status: 'SUBMITTED' } }),
      prisma.exceptionRequest.count({ where: { employeeId, status: 'PENDING' } }),
      // P3-3: single-query weekly trend (replaces 8 sequential aggregates)
      getWeeklyTrend(employeeId),
      prisma.timesheetEntry.groupBy({
        by:    ['projectId'],
        where: {
          timesheet: { employeeId, status: { in: ['SUBMITTED', 'APPROVED'] } },
          entryDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { hours: true },
      }),
    ]);

  const allocatedHours = allocations._sum.allocatedHours ?? 0;
  const submittedHours = submittedEntries._sum.hours ?? 0;
  const utilizationPct = allocatedHours > 0 ? Math.round((submittedHours / allocatedHours) * 100) : 0;

  // Enrich project breakdown with names in one query
  const projectIds = projectBreakdown.map((p) => p.projectId);
  const projects   = await prisma.project.findMany({
    where:  { id: { in: projectIds } },
    select: { id: true, name: true },
  });
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return {
    allocatedHours,
    submittedHours,
    utilizationPct,
    pendingApprovals:  pendingTimesheets,
    pendingExceptions,
    weeklyTrend,
    projectBreakdown: projectBreakdown.map((p) => ({
      projectId:   p.projectId,
      projectName: projectMap[p.projectId] || 'Unknown',
      hours:       p._sum.hours,
    })),
  };
}

/**
 * P3-3: Weekly trend using a single DB query instead of 8 sequential aggregates.
 * Fetches all entries for the last `weeks` weeks in one round-trip,
 * then buckets them in memory.
 */
async function getWeeklyTrend(employeeId, weeks = 8) {
  const now = new Date();

  // Build Monday-anchored week buckets for the last `weeks` weeks
  const buckets = {};
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    monday.setHours(0, 0, 0, 0);
    buckets[format(monday, 'yyyy-MM-dd')] = 0;
  }

  // Oldest Monday we care about
  const oldestMonday = startOfWeek(subWeeks(now, weeks - 1), { weekStartsOn: 1 });
  oldestMonday.setHours(0, 0, 0, 0);

  // Single query — fetch all relevant entries
  const entries = await prisma.timesheetEntry.findMany({
    where: {
      timesheet: { employeeId },
      entryDate: { gte: oldestMonday, lte: now },
    },
    select: { entryDate: true, hours: true },
  });

  // Bucket each entry into its Monday week
  for (const e of entries) {
    const monday = startOfWeek(new Date(e.entryDate), { weekStartsOn: 1 });
    monday.setHours(0, 0, 0, 0);
    const key = format(monday, 'yyyy-MM-dd');
    if (key in buckets) buckets[key] += e.hours;
  }

  return Object.entries(buckets).map(([weekStart, hours]) => ({ weekStart, hours }));
}

// ── PM Dashboard ──────────────────────────────────────────────────────────────
async function getPMDashboard(pmId) {
  const now        = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);

  const projects = await prisma.project.findMany({
    where:   { projectManagerId: pmId, status: 'ACTIVE' },
    include: {
      members:     { select: { employeeId: true } },
      allocations: { select: { allocatedHours: true, employeeId: true } },
    },
  });

  const memberIds = [...new Set(projects.flatMap((p) => p.members.map((m) => m.employeeId)))];

  const [pendingTimesheets, pendingExceptions, teamEntries, totalAllocated] = await Promise.all([
    prisma.timesheet.count({ where: { employeeId: { in: memberIds }, status: 'SUBMITTED' } }),
    prisma.exceptionRequest.count({ where: { employeeId: { in: memberIds }, status: 'PENDING' } }),
    prisma.timesheetEntry.aggregate({
      where: {
        timesheet: { employeeId: { in: memberIds }, status: { in: ['SUBMITTED', 'APPROVED'] } },
        entryDate: { gte: monthStart, lte: monthEnd },
      },
      _sum: { hours: true },
    }),
    prisma.allocation.aggregate({
      where: { employeeId: { in: memberIds } },
      _sum:  { allocatedHours: true },
    }),
  ]);

  const totalAlloc      = totalAllocated._sum.allocatedHours ?? 0;
  const totalUsed       = teamEntries._sum.hours ?? 0;
  const teamUtilization = totalAlloc > 0 ? Math.round((totalUsed / totalAlloc) * 100) : 0;

  // P3-1 (partial): batch per-project used-hours in one grouped query
  const projectIds = projects.map((p) => p.id);
  const usedByProject = await prisma.timesheetEntry.groupBy({
    by:    ['projectId'],
    where: {
      projectId: { in: projectIds },
      entryDate: { gte: monthStart, lte: monthEnd },
      timesheet: { status: { in: ['SUBMITTED', 'APPROVED'] } },
    },
    _sum: { hours: true },
  });
  const usedMap = Object.fromEntries(usedByProject.map((r) => [r.projectId, r._sum.hours ?? 0]));

  const projectAnalytics = projects.map((p) => ({
    projectId:   p.id,
    name:        p.name,
    allocated:   p.allocations.reduce((s, a) => s + a.allocatedHours, 0),
    used:        usedMap[p.id] ?? 0,
    memberCount: p.members.length,
  }));

  return {
    teamUtilization,
    pendingTimesheets,
    pendingExceptions,
    totalMembers:   memberIds.length,
    activeProjects: projects.length,
    projectAnalytics,
  };
}

// ── RM Dashboard ──────────────────────────────────────────────────────────────
async function getRMDashboard() {
  const now        = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);

  const [activeProjects, totalEmployees, pendingTimesheets, pendingExceptions,
         orgAllocated, orgUsed, complianceBreaches] = await Promise.all([
    prisma.project.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { isActive: true, role: { name: 'EMPLOYEE' } } }),
    prisma.timesheet.count({ where: { status: 'SUBMITTED' } }),
    prisma.exceptionRequest.count({ where: { status: 'PENDING' } }),
    prisma.allocation.aggregate({ where: {}, _sum: { allocatedHours: true } }),
    prisma.timesheetEntry.aggregate({
      where: {
        entryDate: { gte: monthStart, lte: monthEnd },
        timesheet: { status: { in: ['SUBMITTED', 'APPROVED'] } },
      },
      _sum: { hours: true },
    }),
    prisma.user.count({
      where: {
        isActive: true,
        role:     { name: 'EMPLOYEE' },
        timesheets: {
          none: {
            weekStart: { gte: monthStart },
            status:    { in: ['SUBMITTED', 'APPROVED'] },
          },
        },
      },
    }),
  ]);

  const totalAlloc     = orgAllocated._sum.allocatedHours ?? 0;
  const totalUsed      = orgUsed._sum.hours ?? 0;
  const orgUtilization = totalAlloc > 0 ? Math.round((totalUsed / totalAlloc) * 100) : 0;

  // P3 (RM skill utilization): avoid deep nested include.
  // Fetch skills + userSkill counts, then check utilization via a separate
  // grouped timesheet query — avoids loading every user's full timesheet list.
  const skills = await prisma.skill.findMany({
    take:    10,
    include: { userSkills: { select: { userId: true } } },
  });

  const allUserIds = [...new Set(skills.flatMap((s) => s.userSkills.map((us) => us.userId)))];

  // Find which users have at least one submitted/approved timesheet this month
  const activeUserIds = allUserIds.length > 0
    ? (await prisma.timesheet.findMany({
        where: {
          employeeId: { in: allUserIds },
          status:     { in: ['SUBMITTED', 'APPROVED'] },
          weekStart:  { gte: monthStart },
        },
        select:  { employeeId: true },
        distinct: ['employeeId'],
      })).map((t) => t.employeeId)
    : [];

  const activeSet = new Set(activeUserIds);

  const skillUtilization = skills.map((s) => ({
    skill:         s.name,
    employeeCount: s.userSkills.length,
    utilizedCount: s.userSkills.filter((us) => activeSet.has(us.userId)).length,
  }));

  return {
    orgUtilization,
    activeProjects,
    totalEmployees,
    pendingTimesheets,
    pendingExceptions,
    complianceBreaches,
    skillUtilization,
  };
}

module.exports = { getEmployeeDashboard, getPMDashboard, getRMDashboard };
