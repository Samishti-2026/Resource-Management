const prisma = require('../../config/database');
const { logAudit } = require('../../services/auditService');

async function listAllocations(query, user) {
  const where = {};
  if (query.employeeId) where.employeeId = parseInt(query.employeeId);
  if (query.projectId) where.projectId = parseInt(query.projectId);

  // Employees only see their own allocations
  if (user.role === 'EMPLOYEE') where.employeeId = user.id;

  return prisma.allocation.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createAllocation(data, actorId) {
  const allocation = await prisma.allocation.create({
    data: {
      employeeId: data.employeeId,
      projectId: data.projectId,
      allocatedHours: data.allocatedHours,
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
