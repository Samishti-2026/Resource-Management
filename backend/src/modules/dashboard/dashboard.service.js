const prisma = require('../../config/database');
const { startOfMonth, endOfMonth, subMonths, format } = require('date-fns');

async function getEmployeeDashboard(employeeId) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [allocations, submittedEntries, pendingTimesheets, pendingExceptions, weeklyTrend, projectBreakdown] =
    await Promise.all([
      // Total allocated hours this month
      prisma.allocation.aggregate({
        where: { employeeId },
        _sum: { allocatedHours: true },
      }),

      // Total submitted/approved hours this month
      prisma.timesheetEntry.aggregate({
        where: {
          timesheet: {
            employeeId,
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
          entryDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { hours: true },
      }),

      // Pending timesheets
      prisma.timesheet.count({ where: { employeeId, status: 'SUBMITTED' } }),

      // Pending exceptions
      prisma.exceptionRequest.count({ where: { employeeId, status: 'PENDING' } }),

      // Weekly trend (last 8 weeks)
      getWeeklyTrend(employeeId),

      // Project breakdown this month
      prisma.timesheetEntry.groupBy({
        by: ['projectId'],
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

  // Enrich project breakdown with names
  const projectIds = projectBreakdown.map((p) => p.projectId);
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true },
  });
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return {
    allocatedHours,
    submittedHours,
    utilizationPct,
    pendingApprovals: pendingTimesheets,
    pendingExceptions,
    weeklyTrend,
    projectBreakdown: projectBreakdown.map((p) => ({
      projectId: p.projectId,
      projectName: projectMap[p.projectId] || 'Unknown',
      hours: p._sum.hours,
    })),
  };
}

async function getWeeklyTrend(employeeId, weeks = 8) {
  const trend = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekDate = subMonths(new Date(), 0);
    weekDate.setDate(weekDate.getDate() - i * 7);
    const weekStart = new Date(weekDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const result = await prisma.timesheetEntry.aggregate({
      where: {
        timesheet: { employeeId },
        entryDate: { gte: weekStart, lte: weekEnd },
      },
      _sum: { hours: true },
    });

    trend.push({
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      hours: result._sum.hours ?? 0,
    });
  }
  return trend;
}

async function getPMDashboard(pmId) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Get PM's projects and members
  const projects = await prisma.project.findMany({
    where: { projectManagerId: pmId, status: 'ACTIVE' },
    include: {
      members: { select: { employeeId: true } },
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
      _sum: { allocatedHours: true },
    }),
  ]);

  const totalAlloc = totalAllocated._sum.allocatedHours ?? 0;
  const totalUsed = teamEntries._sum.hours ?? 0;
  const teamUtilization = totalAlloc > 0 ? Math.round((totalUsed / totalAlloc) * 100) : 0;

  // Project analytics
  const projectAnalytics = await Promise.all(
    projects.map(async (p) => {
      const used = await prisma.timesheetEntry.aggregate({
        where: {
          projectId: p.id,
          entryDate: { gte: monthStart, lte: monthEnd },
          timesheet: { status: { in: ['SUBMITTED', 'APPROVED'] } },
        },
        _sum: { hours: true },
      });
      const allocated = p.allocations.reduce((s, a) => s + a.allocatedHours, 0);
      return {
        projectId: p.id,
        name: p.name,
        allocated,
        used: used._sum.hours ?? 0,
        memberCount: p.members.length,
      };
    })
  );

  return {
    teamUtilization,
    pendingTimesheets,
    pendingExceptions,
    totalMembers: memberIds.length,
    activeProjects: projects.length,
    projectAnalytics,
  };
}

async function getRMDashboard() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [activeProjects, totalEmployees, pendingTimesheets, pendingExceptions, orgAllocated, orgUsed, complianceBreaches] =
    await Promise.all([
      prisma.project.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { isActive: true, role: { name: 'EMPLOYEE' } } }),
      prisma.timesheet.count({ where: { status: 'SUBMITTED' } }),
      prisma.exceptionRequest.count({ where: { status: 'PENDING' } }),
      prisma.allocation.aggregate({
        where: {},
        _sum: { allocatedHours: true },
      }),
      prisma.timesheetEntry.aggregate({
        where: {
          entryDate: { gte: monthStart, lte: monthEnd },
          timesheet: { status: { in: ['SUBMITTED', 'APPROVED'] } },
        },
        _sum: { hours: true },
      }),
      // Employees with no timesheet this month (compliance breach)
      prisma.user.count({
        where: {
          isActive: true,
          role: { name: 'EMPLOYEE' },
          timesheets: {
            none: {
              weekStart: { gte: monthStart },
              status: { in: ['SUBMITTED', 'APPROVED'] },
            },
          },
        },
      }),
    ]);

  const totalAlloc = orgAllocated._sum.allocatedHours ?? 0;
  const totalUsed = orgUsed._sum.hours ?? 0;
  const orgUtilization = totalAlloc > 0 ? Math.round((totalUsed / totalAlloc) * 100) : 0;

  // Skill utilization
  const skills = await prisma.skill.findMany({
    include: {
      userSkills: {
        include: {
          user: {
            include: {
              timesheets: {
                where: { status: { in: ['SUBMITTED', 'APPROVED'] }, weekStart: { gte: monthStart } },
              },
            },
          },
        },
      },
    },
    take: 10,
  });

  const skillUtilization = skills.map((s) => ({
    skill: s.name,
    employeeCount: s.userSkills.length,
    utilizedCount: s.userSkills.filter((us) => us.user.timesheets.length > 0).length,
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
