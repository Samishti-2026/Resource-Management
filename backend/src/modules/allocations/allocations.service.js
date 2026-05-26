const prisma = require('../../config/database');
const { logAudit } = require('../../services/auditService');

async function listAllocations(query, user) {
  const where = {};
  if (query.employeeId) where.employeeId = parseInt(query.employeeId);
  if (query.projectId) where.projectId = parseInt(query.projectId);

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

  // Enrich each allocation with usedHours (submitted + approved entries)
  const enriched = await Promise.all(
    allocations.map(async (a) => {
      const agg = await prisma.timesheetEntry.aggregate({
        where: {
          projectId: a.projectId,
          timesheet: {
            employeeId: a.employeeId,
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
        },
        _sum: { hours: true },
      });
      const usedHours      = agg._sum.hours ?? 0;
      const remainingHours = Math.max(0, a.allocatedHours - usedHours);
      return { ...a, usedHours, remainingHours };
    })
  );

  return enriched;
}

const MAX_PROJECTS_PER_EMPLOYEE = 2;

async function createAllocation(data, actorId) {
  // Enforce max 2 project allocations per employee
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
      employeeId: data.employeeId,
      projectId: data.projectId,
      allocatedHours: data.allocatedHours,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      createdBy: actorId,
    },
    include: {
      employee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });
  await logAudit({ userId: actorId, action: 'CREATE_ALLOCATION', entityType: 'Allocation', entityId: allocation.id, newValue: data });
  return allocation;
}

async function updateAllocation(id, data, actorId) {
  const existing = await prisma.allocation.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Allocation not found'), { statusCode: 404 });

  const updated = await prisma.allocation.update({
    where: { id },
    data: {
      ...(data.allocatedHours !== undefined && { allocatedHours: data.allocatedHours }),
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
    },
    include: {
      employee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });
  await logAudit({ userId: actorId, action: 'UPDATE_ALLOCATION', entityType: 'Allocation', entityId: id, oldValue: existing, newValue: data });
  return updated;
}

async function deleteAllocation(id, actorId) {
  const existing = await prisma.allocation.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Allocation not found'), { statusCode: 404 });
  await prisma.allocation.delete({ where: { id } });
  await logAudit({ userId: actorId, action: 'DELETE_ALLOCATION', entityType: 'Allocation', entityId: id });
}

module.exports = { listAllocations, createAllocation, updateAllocation, deleteAllocation };
