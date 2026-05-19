const express = require('express');
const router = express.Router();
const ctrl = require('./users.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { createUserSchema, updateUserSchema, assignSkillsSchema } = require('./users.validator');

router.use(authenticate);

/**
 * @swagger
 * /users/roles:
 *   get:
 *     tags: [Users]
 *     summary: List all roles
 *     responses:
 *       200:
 *         description: List of roles
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:   { type: integer, example: 1 }
 *                           name: { type: string, example: RESOURCE_MANAGER }
 */
router.get('/roles', ctrl.getRoles);

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List all users
 *     description: Returns paginated list of users. **Resource Manager only.**
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: role
 *         in: query
 *         schema:
 *           type: string
 *           enum: [RESOURCE_MANAGER, PROJECT_MANAGER, EMPLOYEE]
 *         description: Filter by role
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Search by name or email
 *       - name: isActive
 *         in: query
 *         schema: { type: boolean }
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Paginated user list
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
 *                         users:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/User' }
 *                         meta:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', authorize('RESOURCE_MANAGER'), ctrl.list);

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create a new user
 *     description: Creates a new user account. **Resource Manager only.**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/UserBasic' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Email already exists
 */
router.post('/', authorize('RESOURCE_MANAGER'), validate(createUserSchema), ctrl.create);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/User' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', authorize('RESOURCE_MANAGER'), ctrl.getById);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update a user
 *     description: Update name, role, active status, or password. **Resource Manager only.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: User updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id', authorize('RESOURCE_MANAGER'), validate(updateUserSchema), ctrl.update);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Deactivate a user (soft delete)
 *     description: Sets isActive to false. Historical data is preserved. **Resource Manager only.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: User deactivated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', authorize('RESOURCE_MANAGER'), ctrl.remove);

/**
 * @swagger
 * /users/{id}/skills:
 *   post:
 *     tags: [Users]
 *     summary: Assign skills to a user
 *     description: Replaces all existing skill assignments. **Resource Manager only.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [skillIds]
 *             properties:
 *               skillIds:
 *                 type: array
 *                 items: { type: integer }
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Skills assigned
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:id/skills', authorize('RESOURCE_MANAGER'), validate(assignSkillsSchema), ctrl.assignSkills);

module.exports = router;
