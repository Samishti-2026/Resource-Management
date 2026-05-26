const prisma = require('../../config/database');
const { logAudit } = require('../../services/auditService');
const { getPagination, paginationMeta } = require('../../utils/pagination');

// ── Shared helper ─────────────────────────────────────────────────────────────
/**
 * Verify that a Project Manager has authority over the given employee.
 * Throws 403 if the employee is not on any of the PM's projects.
 */
async function assertPMOwnsEmployee(pmId, employeeId) {
  const membership = await prisma.projectMember.findFirst({
    where: { employeeId, project: { projectManagerId: pmId } },
  });
  if (!membership) {
    throw Object.assign(
      new Error('You do not have permission to act on this employee\'s request'),
      { statusCode: 403 }
    );
  }
}

async function listExceptions(query, user) {
  const { skip, limit, page } = getPagination(query);
  const where = {};

  if (query.status)      where.status      = query.status;
  if (query.requestType) where.requestType = query.requestType;

  if (user.role === 'EMPLOYEE') {
    // Employees always see only their own requests — ignore any employeeId filter
    where.employeeId = user.id;
  } else if (user.role === 'PROJECT_MANAGER') {
    // PM sees only their team members' requests
    const memberIds = await prisma.projectMember.findMany({
      where:  { project: { projectManagerId: user.id } },
      select: { employeeId: true },
    });
    const ids = memberIds.map((m) => m.employeeId);

    if (query.employeeId) {
      const requestedId = parseInt(query.employeeId);
      // ── P2-3: Verify the requested employee is on the PM's team ──────────
      if (!ids.includes(requestedId)) {
        throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
      }
      where.employeeId = requestedId;
    } else {
      where.employeeId = { in: ids };
    }
  } else if (query.employeeId) {
    // RESOURCE_MANAGER — can filter by any employee
    where.employeeId = parseInt(query.employeeId);
  }

  const [exceptions, total] = await Promise.all([
    prisma.exceptionRequest.findMany({
      where,
      skip,
      take: limit,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        project:  { select: { id: true, name: true } },
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
      employeeId:  actorId,
      projectId:   data.projectId,
      requestType: data.requestType,
      requestDate: new Date(data.requestDate),
      reason:      data.reason,
    },
    include: { project: { select: { id: true, name: true } } },
  });
  await logAudit({
    userId:     actorId,
    action:     'CREATE_EXCEPTION',
    entityType: 'ExceptionRequest',
    entityId:   exception.id,
    newValue:   data,
  });
  return exception;
}

async function approveException(id, actorId, actorRole) {
  const exception = await prisma.exceptionRequest.findUnique({ where: { id } });
  if (!exception) throw Object.assign(new Error('Exception request not found'), { statusCode: 404 });
  if (exception.status !== 'PENDING') {
    throw Object.assign(new Error('Only pending requests can be approved'), { statusCode: 400 });
  }

  // ── P2-3: PM scope check ─────────────────────────────────────────────────
  if (actorRole === 'PROJECT_MANAGER') {
    await assertPMOwnsEmployee(actorId, exception.employeeId);
  }

  const updated = await prisma.exceptionRequest.update({
    where: { id },
    data:  { status: 'APPROVED', reviewedBy: actorId, reviewedAt: new Date() },
  });
  await logAudit({ userId: actorId, action: 'APPROVE_EXCEPTION', entityType: 'ExceptionRequest', entityId: id });
  return updated;
}

async function rejectException(id, actorId, actorRole) {
  const exception = await prisma.exceptionRequest.findUnique({ where: { id } });
  if (!exception) throw Object.assign(new Error('Exception request not found'), { statusCode: 404 });
  if (exception.status !== 'PENDING') {
    throw Object.assign(new Error('Only pending requests can be rejected'), { statusCode: 400 });
  }

  // ── P2-3: PM scope check ─────────────────────────────────────────────────
  if (actorRole === 'PROJECT_MANAGER') {
    await assertPMOwnsEmployee(actorId, exception.employeeId);
  }

  const updated = await prisma.exceptionRequest.update({
    where: { id },
    data:  { status: 'REJECTED', reviewedBy: actorId, reviewedAt: new Date() },
  });
  await logAudit({ userId: actorId, action: 'REJECT_EXCEPTION', entityType: 'ExceptionRequest', entityId: id });
  return updated;
}

module.exports = { listExceptions, createException, approveException, rejectException };
