const prisma = require('../../config/database');
const { logAudit } = require('../../services/auditService');
const { getPagination, paginationMeta } = require('../../utils/pagination');

async function listExceptions(query, user) {
  const { skip, limit, page } = getPagination(query);
  const where = {};

  if (query.status) where.status = query.status;
  if (query.requestType) where.requestType = query.requestType;

  if (user.role === 'EMPLOYEE') {
    where.employeeId = user.id;
  } else if (query.employeeId) {
    where.employeeId = parseInt(query.employeeId);
  }

  if (user.role === 'PROJECT_MANAGER') {
    const memberIds = await prisma.projectMember.findMany({
      where: { project: { projectManagerId: user.id } },
      select: { employeeId: true },
    });
    const ids = memberIds.map((m) => m.employeeId);
    where.employeeId = query.employeeId ? parseInt(query.employeeId) : { in: ids };
  }

  const [exceptions, total] = await Promise.all([
    prisma.exceptionRequest.findMany({
      where,
      skip,
      take: limit,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.exceptionRequest.count({ where }),
  ]);

  return { exceptions, meta: paginationMeta(total, page, limit) };
}

async function createException(data, actorId) {
  const exception = await prisma.exceptionRequest.create({
    data: {
      employeeId: actorId,
      projectId: data.projectId,
      requestType: data.requestType,
      requestDate: new Date(data.requestDate),
      reason: data.reason,
    },
    include: {
      project: { select: { id: true, name: true } },
    },
  });
  await logAudit({ userId: actorId, action: 'CREATE_EXCEPTION', entityType: 'ExceptionRequest', entityId: exception.id, newValue: data });
  return exception;
}

async function approveException(id, actorId) {
  const exception = await prisma.exceptionRequest.findUnique({ where: { id } });
  if (!exception) throw Object.assign(new Error('Exception request not found'), { statusCode: 404 });
  if (exception.status !== 'PENDING') {
    throw Object.assign(new Error('Only pending requests can be approved'), { statusCode: 400 });
  }

  const updated = await prisma.exceptionRequest.update({
    where: { id },
    data: { status: 'APPROVED', reviewedBy: actorId, reviewedAt: new Date() },
  });
  await logAudit({ userId: actorId, action: 'APPROVE_EXCEPTION', entityType: 'ExceptionRequest', entityId: id });
  return updated;
}

async function rejectException(id, actorId) {
  const exception = await prisma.exceptionRequest.findUnique({ where: { id } });
  if (!exception) throw Object.assign(new Error('Exception request not found'), { statusCode: 404 });
  if (exception.status !== 'PENDING') {
    throw Object.assign(new Error('Only pending requests can be rejected'), { statusCode: 400 });
  }

  const updated = await prisma.exceptionRequest.update({
    where: { id },
    data: { status: 'REJECTED', reviewedBy: actorId, reviewedAt: new Date() },
  });
  await logAudit({ userId: actorId, action: 'REJECT_EXCEPTION', entityType: 'ExceptionRequest', entityId: id });
  return updated;
}

module.exports = { listExceptions, createException, approveException, rejectException };
