const prisma = require('../../config/database');
const { logAudit } = require('../../services/auditService');

// ── Shared helper ─────────────────────────────────────────────────────────────
/**
 * Verify that a Project Manager owns the project the allocation belongs to.
 * Throws 403 if they are not the assigned PM.
 */
async function assertPMOwnsProject(pmId, projectId) {
  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { projectManagerId: true },
  });
  if (!project) throw Object.assign(new Error('Project not found'), { statusCode: 404 });
  if (project.projectManagerId !== pmId) {
    throw Object.assign(
      new Error('You do not have permission to manage allocations for this project'),
      { statusCode: 403 }
    );
  }
}

async function listAllocations(query, user) {
  const where = {};
  if (query.employeeId) where.employeeId = parseInt(query.employeeId);
  if (query.projectId)  where.projectId  = parseInt(query.projectId);

  // Employees only see their own allocations
  if (user.role === 'EMPLOYEE') where.employeeId = user.id;

  const allocations = await prisma.allocation.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true } },
      project:  { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // ── P3-1: Batch usedHours in a single grouped query instead of N+1 ────────
  if (allocations.length === 0) return [];

  const usedHoursRows = await prisma.timesheetEntry.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: allocations.map((a) => a.projectId) },
      timesheet: {
        employeeId: { in: allocations.map((a) => a.employeeId) },
        status:     { in: ['SUBMITTED', 'APPROVED'] },
      },
    },
    _sum: { hours: true },
  });

  // Build a lookup: "employeeId:projectId" → usedHours
  // Note: groupBy is by projectId only; for per-employee accuracy we do a second
  // targeted query only when multiple employees share the same project in the result set.
  const allocationKeys = new Set(allocations.map((a) => `${a.employeeId}:${a.projectId}`));
  const needsPerEmployee = allocationKeys.size > usedHoursRows.length;

  let usedMap = {};
  if (needsPerEmployee) {
    // Fetch per-employee-project aggregates
    const perEmpRows = await Promise.all(
      allocations.map((a) =>
        prisma.timesheetEntry.aggregate({
          where: {
            projectId: a.projectId,
            timesheet: { employeeId: a.employeeId, status: { in: ['SUBMITTED', 'APPROVED'] } },
          },
          _sum: { hours: true },
        }).then((r) => ({ key: `${a.employeeId}:${a.projectId}`, hours: r._sum.hours ?? 0 }))
      )
    );
    usedMap = Object.fromEntries(perEmpRows.map((r) => [r.key, r.hours]));
  } else {
    usedMap = Object.fromEntries(
      usedHoursRows.map((r) => [r.projectId, r._sum.hours ?? 0])
    );
  }

  return allocations.map((a) => {
    const key        = needsPerEmployee ? `${a.employeeId}:${a.projectId}` : a.projectId;
    const usedHours  = usedMap[key] ?? 0;
    return { ...a, usedHours, remainingHours: Math.max(0, a.allocatedHours - usedHours) };
  });
}

const MAX_PROJECTS_PER_EMPLOYEE = 2;

async function createAllocation(data, actorId, actorRole) {
  // ── P2-3: PM can only create allocations for their own project ────────────
  if (actorRole === 'PROJECT_MANAGER') {
    await assertPMOwnsProject(actorId, data.projectId);
  }

  const existingCount = await prisma.allocation.count({
    where: { employeeId: data.employeeId },
  });
  if (existingCount >= MAX_PROJECTS_PER_EMPLOYEE) {
    throw Object.assign(
      new Error(`Employee already has ${existingCount} project allocation(s). Maximum allowed is ${MAX_PROJECTS_PER_EMPLOYEE}.`),
      { statusCode: 400 }
    );
  }

  const allocation = await prisma.allocation.create({
    data: {
      employeeId:     data.employeeId,
      projectId:      data.projectId,
      allocatedHours: data.allocatedHours,
      startDate:      new Date(data.startDate),
      endDate:        new Date(data.endDate),
      createdBy:      actorId,
    },
    include: {
      employee: { select: { id: true, name: true } },
      project:  { select: { id: true, name: true } },
    },
  });
  await logAudit({ userId: actorId, action: 'CREATE_ALLOCATION', entityType: 'Allocation', entityId: allocation.id, newValue: data });
  return allocation;
}

async function updateAllocation(id, data, actorId, actorRole) {
  const existing = await prisma.allocation.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Allocation not found'), { statusCode: 404 });

  // ── P2-3: PM can only update allocations for their own project ────────────
  if (actorRole === 'PROJECT_MANAGER') {
    await assertPMOwnsProject(actorId, existing.projectId);
  }

  const updated = await prisma.allocation.update({
    where: { id },
    data: {
      ...(data.allocatedHours !== undefined && { allocatedHours: data.allocatedHours }),
      ...(data.startDate      !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate        !== undefined && { endDate:   new Date(data.endDate) }),
    },
    include: {
      employee: { select: { id: true, name: true } },
      project:  { select: { id: true, name: true } },
    },
  });
  await logAudit({ userId: actorId, action: 'UPDATE_ALLOCATION', entityType: 'Allocation', entityId: id, oldValue: existing, newValue: data });
  return updated;
}

async function deleteAllocation(id, actorId, actorRole) {
  const existing = await prisma.allocation.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Allocation not found'), { statusCode: 404 });

  // ── P2-3: PM can only delete allocations for their own project ────────────
  if (actorRole === 'PROJECT_MANAGER') {
    await assertPMOwnsProject(actorId, existing.projectId);
  }

  await prisma.allocation.delete({ where: { id } });
  await logAudit({ userId: actorId, action: 'DELETE_ALLOCATION', entityType: 'Allocation', entityId: id });
}

module.exports = { listAllocations, createAllocation, updateAllocation, deleteAllocation };
