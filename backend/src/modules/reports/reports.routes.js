const express = require('express');
const router = express.Router();
const prisma = require('../../config/database');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { generateEmployeeReport, generateUtilizationReport } = require('../../services/excelExport');
const { error } = require('../../utils/apiResponse');

router.use(authenticate);

/**
 * @swagger
 * /reports/employee/{id}:
 *   get:
 *     tags: [Reports]
 *     summary: Download employee timesheet report (Excel)
 *     description: |
 *       Generates and downloads an Excel (.xlsx) file containing all submitted/approved
 *       timesheet entries for the specified employee within the date range.
 *
 *       **Resource Manager or Project Manager only.**
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         description: Employee user ID
 *       - name: from
 *         in: query
 *         required: true
 *         schema: { type: string, format: date, example: "2026-05-01" }
 *         description: Start date (inclusive)
 *       - name: to
 *         in: query
 *         required: true
 *         schema: { type: string, format: date, example: "2026-05-31" }
 *         description: End date (inclusive)
 *     responses:
 *       200:
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema: { type: string }
 *             example: attachment; filename="timesheet-Alice_Resource-2026-05-01-2026-05-31.xlsx"
 *       400:
 *         description: Missing from or to query params
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Employee not found
 */
router.get('/employee/:id', authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return error(res, 'from and to query params required', 400);

    const employeeId = parseInt(req.params.id);
    const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: { name: true } });
    if (!employee) return error(res, 'Employee not found', 404);

    const entries = await prisma.timesheetEntry.findMany({
      where: {
        timesheet: { employeeId, status: { in: ['SUBMITTED', 'APPROVED'] } },
        entryDate: { gte: new Date(from), lte: new Date(to) },
      },
      include: {
        project: { select: { name: true } },
        timesheet: { select: { status: true, weekStart: true } },
      },
      orderBy: { entryDate: 'asc' },
    });

    const data = entries.map((e) => ({
      entryDate: e.entryDate,
      projectName: e.project.name,
      hours: e.hours,
      notes: e.notes,
      status: e.timesheet.status,
      weekStart: e.timesheet.weekStart,
    }));

    const buffer = await generateEmployeeReport(data, employee.name, from, to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="timesheet-${employee.name.replace(/\s/g, '_')}-${from}-${to}.xlsx"`);
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
 *       Generates and downloads an Excel file with all hours logged against the specified project
 *       within the date range, grouped by employee.
 *
 *       **Resource Manager or Project Manager only.**
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         description: Project ID
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
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing from or to query params
 *       404:
 *         description: Project not found
 */
router.get('/project/:id', authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return error(res, 'from and to query params required', 400);

    const projectId = parseInt(req.params.id);
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) return error(res, 'Project not found', 404);

    const entries = await prisma.timesheetEntry.findMany({
      where: {
        projectId,
        entryDate: { gte: new Date(from), lte: new Date(to) },
        timesheet: { status: { in: ['SUBMITTED', 'APPROVED'] } },
      },
      include: {
        timesheet: { include: { employee: { select: { name: true } } } },
      },
      orderBy: { entryDate: 'asc' },
    });

    const data = entries.map((e) => ({
      entryDate: e.entryDate,
      projectName: project.name,
      hours: e.hours,
      notes: e.notes,
      status: e.timesheet.status,
      weekStart: e.timesheet.weekStart,
      employeeName: e.timesheet.employee.name,
    }));

    const buffer = await generateEmployeeReport(data, `Project: ${project.name}`, from, to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="project-${project.name.replace(/\s/g, '_')}-${from}-${to}.xlsx"`);
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
 *       Generates an Excel file with utilization data for all active employees:
 *       - Allocated hours
 *       - Submitted/approved hours
 *       - Utilization percentage
 *       - Status (On Track / Moderate / Low)
 *
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
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing from or to query params
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/utilization', authorize('RESOURCE_MANAGER'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return error(res, 'from and to query params required', 400);

    const employees = await prisma.user.findMany({
      where: { isActive: true, role: { name: 'EMPLOYEE' } },
      select: { id: true, name: true },
    });

    const data = await Promise.all(
      employees.map(async (emp) => {
        const [alloc, used] = await Promise.all([
          prisma.allocation.aggregate({
            where: { employeeId: emp.id },
            _sum: { allocatedHours: true },
          }),
          prisma.timesheetEntry.aggregate({
            where: {
              timesheet: { employeeId: emp.id, status: { in: ['SUBMITTED', 'APPROVED'] } },
              entryDate: { gte: new Date(from), lte: new Date(to) },
            },
            _sum: { hours: true },
          }),
        ]);
        const allocatedHours = alloc._sum.allocatedHours ?? 0;
        const usedHours = used._sum.hours ?? 0;
        return {
          employeeName: emp.name,
          allocatedHours,
          usedHours,
          utilizationPct: allocatedHours > 0 ? Math.round((usedHours / allocatedHours) * 100) : 0,
        };
      })
    );

    const buffer = await generateUtilizationReport(data, from, to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="utilization-${from}-${to}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

module.exports = router;
