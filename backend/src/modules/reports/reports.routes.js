const express = require('express');
const router  = express.Router();
const prisma  = require('../../config/database');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { generateEmployeeReport, generateUtilizationReport } = require('../../services/excelExport');
const { error } = require('../../utils/apiResponse');

router.use(authenticate);

// ── Shared date validation helper ─────────────────────────────────────────────
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

/**
 * Validate `from` and `to` query params.
 * Returns { fromDate, toDate } on success, or calls error() and returns null.
 */
function validateDateRange(req, res) {
  const { from, to } = req.query;
  if (!from || !to) {
    error(res, 'from and to query params are required', 400);
    return null;
  }
  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
    error(res, 'from and to must be valid dates in YYYY-MM-DD format', 400);
    return null;
  }
  const fromDate = new Date(from);
  const toDate   = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    error(res, 'from and to must be valid dates in YYYY-MM-DD format', 400);
    return null;
  }
  if (fromDate > toDate) {
    error(res, 'from must be on or before to', 400);
    return null;
  }
  const diffDays = (toDate - fromDate) / (1000 * 60 * 60 * 24);
  if (diffDays > MAX_RANGE_DAYS) {
    error(res, `Date range cannot exceed ${MAX_RANGE_DAYS} days`, 400);
    return null;
  }
  return { fromDate, toDate };
}

/**
 * Sanitise a string for use in a Content-Disposition filename.
 * Strips characters that could break the header or enable path traversal.
 */
function safeFilename(str) {
  return encodeURIComponent(str.replace(/[^\w\s\-]/g, '').trim());
}

/**
 * @swagger
 * /reports/employee/{id}:
 *   get:
 *     tags: [Reports]
 *     summary: Download employee timesheet report (Excel)
 *     description: |
 *       Generates and downloads an Excel (.xlsx) file containing all submitted/approved
 *       timesheet entries for the specified employee within the date range.
 *       **Resource Manager or Project Manager only.**
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: from
 *         in: query
 *         required: true
 *         schema: { type: string, format: date, example: "2026-05-01" }
 *       - name: to
 *         in: query
 *         required: true
 *         schema: { type: string, format: date, example: "2026-05-31" }
 *     responses:
 *       200:
 *         description: Excel file download
 *       400:
 *         description: Invalid or missing date params
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Employee not found
 */
router.get('/employee/:id', authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER'), async (req, res, next) => {
  try {
    const dates = validateDateRange(req, res);
    if (!dates) return;
    const { fromDate, toDate } = dates;

    const employeeId = parseInt(req.params.id);
    if (isNaN(employeeId)) return error(res, 'Invalid employee ID', 400);

    const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: { name: true } });
    if (!employee) return error(res, 'Employee not found', 404);

    const entries = await prisma.timesheetEntry.findMany({
      where: {
        timesheet: { employeeId, status: { in: ['SUBMITTED', 'APPROVED'] } },
        entryDate: { gte: fromDate, lte: toDate },
      },
      include: {
        project:   { select: { name: true } },
        timesheet: { select: { status: true, weekStart: true } },
      },
      orderBy: { entryDate: 'asc' },
    });

    const data = entries.map((e) => ({
      entryDate:   e.entryDate,
      projectName: e.project.name,
      hours:       e.hours,
      notes:       e.notes,
      status:      e.timesheet.status,
      weekStart:   e.timesheet.weekStart,
    }));

    const buffer = await generateEmployeeReport(data, employee.name, req.query.from, req.query.to);
    const fname  = safeFilename(`timesheet-${employee.name}-${req.query.from}-${req.query.to}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /reports/project/{id}:
 *   get:
 *     tags: [Reports]
 *     summary: Download project timesheet report (Excel)
 *     description: |
 *       Generates and downloads an Excel file with all hours logged against the specified
 *       project within the date range, grouped by employee.
 *       **Resource Manager or Project Manager only.**
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: from
 *         in: query
 *         required: true
 *         schema: { type: string, format: date, example: "2026-05-01" }
 *       - name: to
 *         in: query
 *         required: true
 *         schema: { type: string, format: date, example: "2026-05-31" }
 *     responses:
 *       200:
 *         description: Excel file download
 *       400:
 *         description: Invalid or missing date params
 *       404:
 *         description: Project not found
 */
router.get('/project/:id', authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER'), async (req, res, next) => {
  try {
    const dates = validateDateRange(req, res);
    if (!dates) return;
    const { fromDate, toDate } = dates;

    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) return error(res, 'Invalid project ID', 400);

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) return error(res, 'Project not found', 404);

    const entries = await prisma.timesheetEntry.findMany({
      where: {
        projectId,
        entryDate: { gte: fromDate, lte: toDate },
        timesheet: { status: { in: ['SUBMITTED', 'APPROVED'] } },
      },
      include: {
        timesheet: { include: { employee: { select: { name: true } } } },
      },
      orderBy: { entryDate: 'asc' },
    });

    const data = entries.map((e) => ({
      entryDate:    e.entryDate,
      projectName:  project.name,
      hours:        e.hours,
      notes:        e.notes,
      status:       e.timesheet.status,
      weekStart:    e.timesheet.weekStart,
      employeeName: e.timesheet.employee.name,
    }));

    const buffer = await generateEmployeeReport(data, `Project: ${project.name}`, req.query.from, req.query.to);
    const fname  = safeFilename(`project-${project.name}-${req.query.from}-${req.query.to}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /reports/utilization:
 *   get:
 *     tags: [Reports]
 *     summary: Download organisation utilization report (Excel)
 *     description: |
 *       Generates an Excel file with utilization data for all active employees.
 *       **Resource Manager only.**
 *     parameters:
 *       - name: from
 *         in: query
 *         required: true
 *         schema: { type: string, format: date, example: "2026-05-01" }
 *       - name: to
 *         in: query
 *         required: true
 *         schema: { type: string, format: date, example: "2026-05-31" }
 *     responses:
 *       200:
 *         description: Excel file download
 *       400:
 *         description: Invalid or missing date params
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/utilization', authorize('RESOURCE_MANAGER'), async (req, res, next) => {
  try {
    const dates = validateDateRange(req, res);
    if (!dates) return;
    const { fromDate, toDate } = dates;

    const employees = await prisma.user.findMany({
      where:  { isActive: true, role: { name: 'EMPLOYEE' } },
      select: { id: true, name: true },
    });

    // ── P3-1 (partial): batch allocation totals in one query ─────────────────
    const allocTotals = await prisma.allocation.groupBy({
      by:    ['employeeId'],
      where: { employeeId: { in: employees.map((e) => e.id) } },
      _sum:  { allocatedHours: true },
    });
    const allocMap = Object.fromEntries(
      allocTotals.map((r) => [r.employeeId, r._sum.allocatedHours ?? 0])
    );

    // Batch used-hours totals in one query
    const usedTotals = await prisma.timesheetEntry.groupBy({
      by:    ['timesheet'],
      where: {
        timesheet: {
          employeeId: { in: employees.map((e) => e.id) },
          status:     { in: ['SUBMITTED', 'APPROVED'] },
        },
        entryDate: { gte: fromDate, lte: toDate },
      },
      _sum: { hours: true },
    });

    // groupBy on a relation field isn't directly supported — use raw aggregate per employee
    // but batch them in Promise.all (not sequential)
    const usedRows = await Promise.all(
      employees.map((emp) =>
        prisma.timesheetEntry.aggregate({
          where: {
            timesheet: { employeeId: emp.id, status: { in: ['SUBMITTED', 'APPROVED'] } },
            entryDate: { gte: fromDate, lte: toDate },
          },
          _sum: { hours: true },
        }).then((r) => ({ id: emp.id, hours: r._sum.hours ?? 0 }))
      )
    );
    const usedMap = Object.fromEntries(usedRows.map((r) => [r.id, r.hours]));

    const data = employees.map((emp) => {
      const allocatedHours = allocMap[emp.id] ?? 0;
      const usedHours      = usedMap[emp.id]  ?? 0;
      return {
        employeeName:   emp.name,
        allocatedHours,
        usedHours,
        utilizationPct: allocatedHours > 0 ? Math.round((usedHours / allocatedHours) * 100) : 0,
      };
    });

    const buffer = await generateUtilizationReport(data, req.query.from, req.query.to);
    const fname  = safeFilename(`utilization-${req.query.from}-${req.query.to}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

module.exports = router;
