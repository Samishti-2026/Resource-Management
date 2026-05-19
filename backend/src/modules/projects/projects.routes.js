const express = require('express');
const router = express.Router();
const ctrl = require('./projects.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { createProjectSchema, updateProjectSchema, addMemberSchema } = require('./projects.validator');

router.use(authenticate);

/**
 * @swagger
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: List projects
 *     description: |
 *       Returns projects scoped by role:
 *       - **Resource Manager**: all projects
 *       - **Project Manager**: only their managed projects
 *       - **Employee**: only projects they are a member of
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [ACTIVE, ARCHIVED] }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Search by project name
 *     responses:
 *       200:
 *         description: Project list
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
 *                         projects:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Project' }
 *                         meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/', ctrl.list);

/**
 * @swagger
 * /projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a project
 *     description: Creates a new project and assigns a Project Manager. **Resource Manager only.**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProjectRequest'
 *     responses:
 *       201:
 *         description: Project created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Project' }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', authorize('RESOURCE_MANAGER'), validate(createProjectSchema), ctrl.create);

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project by ID
 *     description: Returns project details including members and allocations.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Project details
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', ctrl.getById);

/**
 * @swagger
 * /projects/{id}:
 *   patch:
 *     tags: [Projects]
 *     summary: Update a project
 *     description: Update name, description, or assigned PM. **Resource Manager or Project Manager.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:             { type: string }
 *               description:      { type: string }
 *               projectManagerId: { type: integer }
 *     responses:
 *       200:
 *         description: Project updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id', authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER'), validate(updateProjectSchema), ctrl.update);

/**
 * @swagger
 * /projects/{id}/archive:
 *   patch:
 *     tags: [Projects]
 *     summary: Archive a project
 *     description: Sets project status to ARCHIVED. **Resource Manager only.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Project archived
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/archive', authorize('RESOURCE_MANAGER'), ctrl.archive);

/**
 * @swagger
 * /projects/{id}/members:
 *   get:
 *     tags: [Projects]
 *     summary: List project members
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Member list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ProjectMember' }
 */
router.get('/:id/members', ctrl.getMembers);

/**
 * @swagger
 * /projects/{id}/members:
 *   post:
 *     tags: [Projects]
 *     summary: Add a member to a project
 *     description: Adds an employee to the project team. **Resource Manager or Project Manager.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [employeeId]
 *             properties:
 *               employeeId: { type: integer, example: 3 }
 *     responses:
 *       201:
 *         description: Member added
 *       409:
 *         description: Employee already a member
 */
router.post('/:id/members', authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER'), validate(addMemberSchema), ctrl.addMember);

/**
 * @swagger
 * /projects/{id}/members/{uid}:
 *   delete:
 *     tags: [Projects]
 *     summary: Remove a member from a project
 *     description: Removes an employee from the project team. **Resource Manager or Project Manager.**
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *       - name: uid
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *         description: Employee ID to remove
 *     responses:
 *       200:
 *         description: Member removed
 */
router.delete('/:id/members/:uid', authorize('RESOURCE_MANAGER', 'PROJECT_MANAGER'), ctrl.removeMember);

module.exports = router;
