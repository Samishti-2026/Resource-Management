const prisma = require('../../config/database');
const { getWeekStart, toDateString } = require('../../utils/dateUtils');
const { getISOWeek, addDays } = require('date-fns');
const { validateTimesheetForSubmission } = require('../../services/validationEngine');
const { logAudit } = require('../../services/auditService');
const { getPagination, paginationMeta } = require('../../utils/pagination');

// ── Shared helper ─────────────────────────────────────────────────────────────
/**
 * Verify that a Project Manager has authority over the employee whose timesheet
 * is being acted on. Throws 403 if the employee is not on any of the PM's projects.
 */
async function assertPMOwnsEmployee(pmId, employeeId) {
  const membership = await prisma.projectMember.findFirst({
    where: { employeeId, project: { projectManagerId: pmId } },
  });
  if (!membership) {
    throw Object.assign(
      new Error('You do not have permission to act on this employee\'s timesheet'),
      { statusCode: 403 }
    );
  }
}

async function listTimesheets(query, user) {
  const { skip, limit, page } = getPagination(query);
  const where = {};

  if (query.status) where.status = query.status;
  if (query.weekStart) where.weekStart = new Date(query.weekStart);

  if (user.role === 'EMPLOYEE') {
    where.employeeId = user.id;
  } else if (query.employeeId) {
    where.employeeId = parseInt(query.employeeId);
  }

  // PM sees timesheets from their project members only
  if (user.role === 'PROJECT_MANAGER') {
    const memberIds = await prisma.projectMember.findMany({
      where: { project: { projectManagerId: user.id } },
      select: { employeeId: true },
    });
    const ids = memberIds.map((m) => m.employeeId);

    // If a specific employeeId is requested, verify it belongs to the PM's team
    if (query.employeeId) {
      const requestedId = parseInt(query.employeeId);
      if (!ids.includes(requestedId)) {
        throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
      }
      where.employeeId = requestedId;
    } else {
      where.employeeId = { in: ids };
    }
  }

  const [timesheets, total] = await Promise.all([
    prisma.timesheet.findMany({
      where,
      skip,
      take: limit,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        entries:  { include: { project: { select: { id: true, name: true } } } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { weekStart: 'desc' },
    }),
    prisma.timesheet.count({ where }),
  ]);

  return { timesheets, meta: paginationMeta(total, page, limit) };
}

async function getTimesheetById(id, user) {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      entries: {
        include: { project: { select: { id: true, name: true } } },
        orderBy: { entryDate: 'asc' },
      },
      reviewer: { select: { id: true, name: true } },
    },
  });
  if (!timesheet) throw Object.assign(new Error('Timesheet not found'), { statusCode: 404 });

  // Employees can only view their own timesheets
  if (user.role === 'EMPLOYEE' && timesheet.employeeId !== user.id) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  // PMs can only view timesheets of employees on their projects
  if (user.role === 'PROJECT_MANAGER') {
    await assertPMOwnsEmployee(user.id, timesheet.employeeId);
  }

  return timesheet;
}

async function upsertTimesheet(employeeId, weekStartStr) {
  const weekStart  = getWeekStart(weekStartStr);
  const weekEnd    = addDays(weekStart, 6);
  const weekNumber = getISOWeek(weekStart);

  const existing = await prisma.timesheet.findUnique({
    where: { employeeId_weekStart: { employeeId, weekStart } },
  });
  if (existing) return existing;

  return prisma.timesheet.create({
    data: { employeeId, weekStart, weekEnd, weekNumber, status: 'DRAFT' },
  });
}

async function saveEntries(timesheetId, entries, actorId, remarks) {
  const timesheet = await prisma.timesheet.findUnique({ where: { id: timesheetId } });
  if (!timesheet) throw Object.assign(new Error('Timesheet not found'), { statusCode: 404 });

  // ── P1-4: Ownership check — employee can only edit their own timesheet ────
  if (timesheet.employeeId !== actorId) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  if (!['DRAFT', 'REJECTED'].includes(timesheet.status)) {
    throw Object.assign(new Error('Cannot edit a submitted or approved timesheet'), { statusCode: 400 });
  }

  // Replace all entries and update remarks in one transaction
  await prisma.$transaction(async (tx) => {
    await tx.timesheetEntry.deleteMany({ where: { timesheetId } });
    if (entries.length > 0) {
      await tx.timesheetEntry.createMany({
        data: entries.map((e) => ({
          timesheetId,
          projectId: e.projectId,
          entryDate: new Date(e.entryDate),
          hours:     e.hours,
          notes:     e.notes || null,
        })),
      });
    }
    if (remarks !== undefined) {
      await tx.timesheet.update({
        where: { id: timesheetId },
        data:  { remarks: remarks || null },
      });
    }
  });

  return prisma.timesheet.findUnique({
    where:   { id: timesheetId },
    include: { entries: { include: { project: { select: { id: true, name: true } } } } },
  });
}

async function submitTimesheet(timesheetId, actorId) {
  const timesheet = await prisma.timesheet.findUnique({
    where:   { id: timesheetId },
    include: { entries: true },
  });
  if (!timesheet) throw Object.assign(new Error('Timesheet not found'), { statusCode: 404 });
  if (timesheet.employeeId !== actorId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  if (!['DRAFT', 'REJECTED'].includes(timesheet.status)) {
    throw Object.assign(new Error('Timesheet cannot be submitted in its current state'), { statusCode: 400 });
  }
  if (timesheet.entries.length === 0) {
    throw Object.assign(new Error('Cannot submit an empty timesheet'), { statusCode: 400 });
  }

  const validation = await validateTimesheetForSubmission(timesheetId);
  if (!validation.valid) {
    const err = Object.assign(new Error('Timesheet validation failed'), { statusCode: 422 });
    err.validationErrors = validation.entryErrors;
    throw err;
  }

  const updated = await prisma.timesheet.update({
    where: { id: timesheetId },
    data:  { status: 'SUBMITTED', submittedAt: new Date() },
  });

  await logAudit({ userId: actorId, action: 'SUBMIT_TIMESHEET', entityType: 'Timesheet', entityId: timesheetId });
  return updated;
}

async function approveTimesheet(timesheetId, actorId, actorRole, approveRemarks) {
  const timesheet = await prisma.timesheet.findUnique({ where: { id: timesheetId } });
  if (!timesheet) throw Object.assign(new Error('Timesheet not found'), { statusCode: 404 });
  if (timesheet.status !== 'SUBMITTED') {
    throw Object.assign(new Error('Only submitted timesheets can be approved'), { statusCode: 400 });
  }

  // ── P2-3: PM scope check — PM can only approve timesheets of their team ───
  if (actorRole === 'PROJECT_MANAGER') {
    await assertPMOwnsEmployee(actorId, timesheet.employeeId);
  }

  const updated = await prisma.timesheet.update({
    where: { id: timesheetId },
    data: {
      status:      'APPROVED',
      reviewedAt:  new Date(),
      reviewedBy:  actorId,
      rejectReason: null,
      ...(approveRemarks !== undefined && { remarks: approveRemarks || null }),
    },
  });

  await logAudit({ userId: actorId, action: 'APPROVE_TIMESHEET', entityType: 'Timesheet', entityId: timesheetId });
  return updated;
}

async function rejectTimesheet(timesheetId, reason, actorId, actorRole) {
  const timesheet = await prisma.timesheet.findUnique({ where: { id: timesheetId } });
  if (!timesheet) throw Object.assign(new Error('Timesheet not found'), { statusCode: 404 });
  if (timesheet.status !== 'SUBMITTED') {
    throw Object.assign(new Error('Only submitted timesheets can be rejected'), { statusCode: 400 });
  }

  // ── P2-3: PM scope check ─────────────────────────────────────────────────
  if (actorRole === 'PROJECT_MANAGER') {
    await assertPMOwnsEmployee(actorId, timesheet.employeeId);
  }

  const updated = await prisma.timesheet.update({
    where: { id: timesheetId },
    data:  { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: actorId, rejectReason: reason },
  });

  await logAudit({ userId: actorId, action: 'REJECT_TIMESHEET', entityType: 'Timesheet', entityId: timesheetId, newValue: { reason } });
  return updated;
}

async function copyPreviousWeek(timesheetId, actorId) {
  const timesheet = await prisma.timesheet.findUnique({ where: { id: timesheetId } });
  if (!timesheet) throw Object.assign(new Error('Timesheet not found'), { statusCode: 404 });
  if (timesheet.employeeId !== actorId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });

  const prevWeekStart = new Date(timesheet.weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const prevTimesheet = await prisma.timesheet.findUnique({
    where:   { employeeId_weekStart: { employeeId: actorId, weekStart: prevWeekStart } },
    include: { entries: true },
  });

  if (!prevTimesheet || prevTimesheet.entries.length === 0) {
    throw Object.assign(new Error('No previous week timesheet found to copy'), { statusCode: 404 });
  }

  const newEntries = prevTimesheet.entries.map((e) => {
    const newDate = new Date(e.entryDate);
    newDate.setDate(newDate.getDate() + 7);
    return { projectId: e.projectId, entryDate: toDateString(newDate), hours: e.hours, notes: e.notes };
  });

  return saveEntries(timesheetId, newEntries, actorId);
}

module.exports = {
  listTimesheets,
  getTimesheetById,
  upsertTimesheet,
  saveEntries,
  submitTimesheet,
  approveTimesheet,
  rejectTimesheet,
  copyPreviousWeek,
};
