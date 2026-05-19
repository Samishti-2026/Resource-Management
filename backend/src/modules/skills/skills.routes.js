const express = require('express');
const router = express.Router();
const skillsService = require('./skills.service');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { success, created } = require('../../utils/apiResponse');

router.use(authenticate);

/**
 * @swagger
 * /skills:
 *   get:
 *     tags: [Skills]
 *     summary: List all skills
 *     description: Returns all skills in the catalog with employee count.
 *     responses:
 *       200:
 *         description: Skill list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Skill' }
 */
router.get('/', async (req, res, next) => {
  try { return success(res, await skillsService.listSkills()); } catch (e) { next(e); }
});

/**
 * @swagger
 * /skills:
 *   post:
 *     tags: [Skills]
 *     summary: Create a skill
 *     description: Adds a new skill to the catalog. **Resource Manager only.**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string, example: React }
 *               description: { type: string, example: React.js frontend development }
 *     responses:
 *       201:
 *         description: Skill created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Skill' }
 *       409:
 *         description: Skill name already exists
 */
router.post('/', authorize('RESOURCE_MANAGER'), async (req, res, next) => {
  try { return created(res, await skillsService.createSkill(req.body, req.user.id)); } catch (e) { next(e); }
});

/**
 * @swagger
 * /skills/{id}:
 *   patch:
 *     tags: [Skills]
 *     summary: Update a skill
 *     description: Update skill name or description. **Resource Manager only.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:        { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Skill updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id', authorize('RESOURCE_MANAGER'), async (req, res, next) => {
  try { return success(res, await skillsService.updateSkill(parseInt(req.params.id), req.body, req.user.id)); } catch (e) { next(e); }
});

/**
 * @swagger
 * /skills/{id}:
 *   delete:
 *     tags: [Skills]
 *     summary: Delete a skill
 *     description: Removes skill from catalog and all user assignments. **Resource Manager only.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Skill deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', authorize('RESOURCE_MANAGER'), async (req, res, next) => {
  try { await skillsService.deleteSkill(parseInt(req.params.id), req.user.id); return success(res, null, 'Skill deleted'); } catch (e) { next(e); }
});

module.exports = router;
