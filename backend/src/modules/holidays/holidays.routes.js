const express = require('express');
const router = express.Router();
const ctrl = require('./holidays.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

router.use(authenticate);

/**
 * @swagger
 * /holidays:
 *   get:
 *     tags: [Holidays]
 *     summary: List company holidays
 *     description: Returns all holidays. Optionally filter by year. Used by the timesheet validation engine.
 *     parameters:
 *       - name: year
 *         in: query
 *         schema: { type: integer, example: 2026 }
 *         description: Filter by calendar year
 *     responses:
 *       200:
 *         description: Holiday list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Holiday' }
 *             example:
 *               success: true
 *               message: Success
 *               data:
 *                 - id: 1
 *                   holidayDate: "2026-12-25"
 *                   holidayName: "Christmas Day"
 *                 - id: 2
 *                   holidayDate: "2026-01-01"
 *                   holidayName: "New Year's Day"
 */
router.get('/', ctrl.list);

/**
 * @swagger
 * /holidays/bulk:
 *   post:
 *     tags: [Holidays]
 *     summary: Bulk create or update holidays
 *     description: |
 *       Creates multiple holidays at once. If a holiday already exists on a given date, it is updated (upsert).
 *       Used to upload the annual company holiday calendar.
 *       **Resource Manager only.**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkHolidayRequest'
 *           example:
 *             holidays:
 *               - date: "2026-12-25"
 *                 name: "Christmas Day"
 *               - date: "2026-12-26"
 *                 name: "Boxing Day"
 *               - date: "2027-01-01"
 *                 name: "New Year's Day"
 *     responses:
 *       201:
 *         description: Holidays saved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Holiday' }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/bulk', authorize('RESOURCE_MANAGER'), ctrl.bulkCreate);

/**
 * @swagger
 * /holidays/{id}:
 *   delete:
 *     tags: [Holidays]
 *     summary: Delete a holiday
 *     description: Removes a holiday from the calendar. **Resource Manager only.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Holiday deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/:id', authorize('RESOURCE_MANAGER'), ctrl.remove);

module.exports = router;
