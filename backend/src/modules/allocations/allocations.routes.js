const express = require('express');
const router = express.Router();
const ctrl = require('./allocations.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { createAllocationSchema, updateAllocationSchema } = require('./allocations.validator');

router.use(authenticate);

/**
 * @swagger
 * /allocations:
 *   get:
 *     tags: [Allocations]
 *     summary: List allocations
 *     description: |
 *       Returns allocations scoped by role:
 *       - **Employee**: only their own allocations
 *       - **PM / RM**: all allocations (filterable)
 *     parameters:
 *       - name: employeeId
 *         in: query
 *         schema: { type: integer }
 *         description: Filter by employee
 *       - name: projectId
 *         in: query
 *         schema: { type: integer }
 *         description: Filter by project
 *     responses:
 *       200:
 *         description: Allocation list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Allocation' }
 */
router.get('/', ctrl.list);

/**
 * @swagger
 * /allocations:
 *   post:
 *     tags: [Allocations]
 *     summary: Create an allocation
 *     description: Assigns a number of hours to an employee for a project. **Resource Manager or Project Manager.**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAllocationRequest'
 *     responses:
 *       201:
 *         description: Allocation created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Allocation' }
 *       409:
 *         description: Allocation already exists for this employee/project combination
 */
router.post('/', authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER'), validate(createAllocationSchema), ctrl.create);

/**
 * @swagger
 * /allocations/{id}:
 *   patch:
 *     tags: [Allocations]
 *     summary: Update allocated hours
 *     description: Increase or reduce the allocated hours. **Resource Manager or Project Manager.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allocatedHours: { type: number, minimum: 1, example: 200 }
 *     responses:
 *       200:
 *         description: Allocation updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id', authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER'), validate(updateAllocationSchema), ctrl.update);

/**
 * @swagger
 * /allocations/{id}:
 *   delete:
 *     tags: [Allocations]
 *     summary: Delete an allocation
 *     description: Removes the allocation. **Resource Manager or Project Manager.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Allocation deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER'), ctrl.remove);

module.exports = router;
