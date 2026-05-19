const express = require('express');
const router = express.Router();
const dashboardService = require('./dashboard.service');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { success } = require('../../utils/apiResponse');

router.use(authenticate);

/**
 * @swagger
 * /dashboard/employee:
 *   get:
 *     tags: [Dashboard]
 *     summary: Employee dashboard
 *     description: |
 *       Returns the current employee's utilization metrics for this month:
 *       - Allocated vs submitted hours
 *       - Utilization percentage
 *       - Pending approvals and work requests
 *       - Weekly hours trend (last 8 weeks)
 *       - Project breakdown
 *
 *       **Employee only.**
 *     responses:
 *       200:
 *         description: Employee dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/EmployeeDashboard' }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/employee', authorize('EMPLOYEE'), async (req, res, next) => {
  try {
    return success(res, await dashboardService.getEmployeeDashboard(req.user.id));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /dashboard/pm:
 *   get:
 *     tags: [Dashboard]
 *     summary: Project Manager dashboard
 *     description: |
 *       Returns team-level metrics for the PM's projects:
 *       - Team utilization percentage
 *       - Pending timesheet approvals
 *       - Pending work requests
 *       - Per-project analytics (allocated vs used hours)
 *
 *       **Project Manager only.**
 *     responses:
 *       200:
 *         description: PM dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/PMDashboard' }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/pm', authorize('PROJECT_MANAGER'), async (req, res, next) => {
  try {
    return success(res, await dashboardService.getPMDashboard(req.user.id));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /dashboard/rm:
 *   get:
 *     tags: [Dashboard]
 *     summary: Resource Manager dashboard
 *     description: |
 *       Returns organisation-wide metrics:
 *       - Overall utilization percentage
 *       - Active projects and total employees
 *       - Compliance breaches (employees with no timesheet this month)
 *       - Skill utilization breakdown
 *
 *       **Resource Manager only.**
 *     responses:
 *       200:
 *         description: RM dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/RMDashboard' }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/rm', authorize('RESOURCE_MANAGER'), async (req, res, next) => {
  try {
    return success(res, await dashboardService.getRMDashboard());
  } catch (err) { next(err); }
});

module.exports = router;
