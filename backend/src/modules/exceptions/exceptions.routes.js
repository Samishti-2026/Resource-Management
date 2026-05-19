const express = require('express');
const router = express.Router();
const ctrl = require('./exceptions.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { createExceptionSchema } = require('./exceptions.validator');

router.use(authenticate);

/**
 * @swagger
 * /exceptions:
 *   get:
 *     tags: [Work Requests]
 *     summary: List work requests (exception requests)
 *     description: |
 *       Returns exception requests scoped by role:
 *       - **Employee**: only their own requests
 *       - **Project Manager**: requests from their team members
 *       - **Resource Manager**: all requests
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *       - name: requestType
 *         in: query
 *         schema: { type: string, enum: [WEEKEND, HOLIDAY, BACKDATE, ALLOCATION_BREACH] }
 *       - name: employeeId
 *         in: query
 *         schema: { type: integer }
 *         description: Filter by employee (PM/RM only)
 *     responses:
 *       200:
 *         description: Exception request list
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
 *                         exceptions:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/ExceptionRequest' }
 *                         meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/', ctrl.list);

/**
 * @swagger
 * /exceptions:
 *   post:
 *     tags: [Work Requests]
 *     summary: Raise a work request
 *     description: |
 *       Employee raises a request to log hours outside normal rules.
 *
 *       **Request types:**
 *       - `WEEKEND` — work on Saturday or Sunday
 *       - `HOLIDAY` — work on a company holiday
 *       - `BACKDATE` — log hours more than 14 days in the past
 *       - `ALLOCATION_BREACH` — exceed allocated project hours
 *
 *       Once approved by a PM, the employee can submit the restricted timesheet entry.
 *       **Employee only.**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateExceptionRequest'
 *     responses:
 *       201:
 *         description: Request submitted
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/ExceptionRequest' }
 */
router.post('/', authorize('EMPLOYEE'), validate(createExceptionSchema), ctrl.create);

/**
 * @swagger
 * /exceptions/{id}/approve:
 *   post:
 *     tags: [Work Requests]
 *     summary: Approve a work request
 *     description: Approves the request, allowing the employee to log the restricted hours. **Project Manager or Resource Manager.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Request approved
 *       400:
 *         description: Request is not in PENDING state
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:id/approve', authorize('PROJECT_MANAGER', 'RESOURCE_MANAGER'), ctrl.approve);

/**
 * @swagger
 * /exceptions/{id}/reject:
 *   post:
 *     tags: [Work Requests]
 *     summary: Reject a work request
 *     description: Rejects the request. **Project Manager or Resource Manager.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Request rejected
 *       400:
 *         description: Request is not in PENDING state
 */
router.post('/:id/reject', authorize('PROJECT_MANAGER', 'RESOURCE_MANAGER'), ctrl.reject);

module.exports = router;
