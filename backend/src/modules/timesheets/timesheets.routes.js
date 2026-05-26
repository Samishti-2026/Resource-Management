const express = require('express');
const router = express.Router();
const ctrl = require('./timesheets.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { createTimesheetSchema, saveEntriesSchema, rejectSchema, approveSchema } = require('./timesheets.validator');

router.use(authenticate);

/**
 * @swagger
 * /timesheets:
 *   get:
 *     tags: [Timesheets]
 *     summary: List timesheets
 *     description: |
 *       Returns timesheets scoped by role:
 *       - **Employee**: only their own timesheets
 *       - **Project Manager**: timesheets from their project members
 *       - **Resource Manager**: all timesheets
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [DRAFT, SUBMITTED, APPROVED, REJECTED] }
 *       - name: employeeId
 *         in: query
 *         schema: { type: integer }
 *         description: Filter by employee (PM/RM only)
 *       - name: weekStart
 *         in: query
 *         schema: { type: string, format: date }
 *         description: Filter by week start date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Timesheet list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         timesheets:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Timesheet' }
 *                         meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/', ctrl.list);

/**
 * @swagger
 * /timesheets:
 *   post:
 *     tags: [Timesheets]
 *     summary: Create or get timesheet for a week
 *     description: |
 *       Creates a new DRAFT timesheet for the given week start date.
 *       If a timesheet already exists for that week, returns the existing one (idempotent).
 *       **Employee only.**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [weekStart]
 *             properties:
 *               weekStart:
 *                 type: string
 *                 format: date
 *                 example: "2026-05-19"
 *                 description: Must be a Monday
 *     responses:
 *       201:
 *         description: Timesheet created or returned
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Timesheet' }
 */
router.post('/', authorize('EMPLOYEE'), validate(createTimesheetSchema), ctrl.create);

/**
 * @swagger
 * /timesheets/{id}:
 *   get:
 *     tags: [Timesheets]
 *     summary: Get timesheet by ID
 *     description: Returns full timesheet with all entries. Employees can only access their own.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Timesheet details
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Timesheet' }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', ctrl.getById);

/**
 * @swagger
 * /timesheets/{id}:
 *   patch:
 *     tags: [Timesheets]
 *     summary: Save timesheet entries (draft)
 *     description: |
 *       Replaces all entries for the timesheet. Only allowed when status is **DRAFT** or **REJECTED**.
 *       **Employee only.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SaveEntriesRequest'
 *     responses:
 *       200:
 *         description: Entries saved
 *       400:
 *         description: Cannot edit a submitted or approved timesheet
 */
router.patch('/:id', authorize('EMPLOYEE'), validate(saveEntriesSchema), ctrl.saveEntries);

/**
 * @swagger
 * /timesheets/{id}/submit:
 *   post:
 *     tags: [Timesheets]
 *     summary: Submit timesheet for approval
 *     description: |
 *       Runs all 5 validation rules before submitting:
 *       1. Date range (max 14 days past, 7 days future)
 *       2. Weekend restriction
 *       3. Holiday restriction
 *       4. Max 12h/day
 *       5. Allocation limit
 *
 *       **Employee only.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Timesheet submitted
 *       400:
 *         description: Empty timesheet or invalid state
 *       422:
 *         description: Validation rules failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: Timesheet validation failed }
 *                 validationErrors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       entryId:   { type: integer }
 *                       entryDate: { type: string, format: date }
 *                       errors:    { type: array, items: { type: string } }
 */
router.post('/:id/submit', authorize('EMPLOYEE'), ctrl.submit);

/**
 * @swagger
 * /timesheets/{id}/copy-previous:
 *   post:
 *     tags: [Timesheets]
 *     summary: Copy previous week's entries
 *     description: Copies all entries from the previous week's timesheet into this one. **Employee only.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Previous week copied
 *       404:
 *         description: No previous week timesheet found
 */
router.post('/:id/copy-previous', authorize('EMPLOYEE'), ctrl.copyPrevious);

/**
 * @swagger
 * /timesheets/{id}/approve:
 *   post:
 *     tags: [Timesheets]
 *     summary: Approve a submitted timesheet
 *     description: Approves the timesheet. Only works on SUBMITTED timesheets. **Project Manager or Resource Manager.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Timesheet approved
 *       400:
 *         description: Timesheet is not in SUBMITTED state
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/:id/approve', authorize('PROJECT_MANAGER', 'RESOURCE_MANAGER'), validate(approveSchema), ctrl.approve);

/**
 * @swagger
 * /timesheets/{id}/reject:
 *   post:
 *     tags: [Timesheets]
 *     summary: Reject a submitted timesheet
 *     description: Rejects the timesheet with a reason. Employee can then edit and resubmit. **Project Manager or Resource Manager.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RejectTimesheetRequest'
 *     responses:
 *       200:
 *         description: Timesheet rejected
 *       400:
 *         description: Timesheet is not in SUBMITTED state
 */
router.post('/:id/reject', authorize('PROJECT_MANAGER', 'RESOURCE_MANAGER'), validate(rejectSchema), ctrl.reject);

module.exports = router;
