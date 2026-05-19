const projectsService = require('./projects.service');
const { success, created } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const result = await projectsService.listProjects(req.query, req.user);
    return success(res, result);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const project = await projectsService.getProjectById(parseInt(req.params.id), req.user);
    return success(res, project);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const project = await projectsService.createProject(req.body, req.user.id);
    return created(res, project, 'Project created successfully');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const project = await projectsService.updateProject(parseInt(req.params.id), req.body, req.user.id);
    return success(res, project, 'Project updated successfully');
  } catch (err) { next(err); }
};

const archive = async (req, res, next) => {
  try {
    const project = await projectsService.archiveProject(parseInt(req.params.id), req.user.id);
    return success(res, project, 'Project archived successfully');
  } catch (err) { next(err); }
};

const getMembers = async (req, res, next) => {
  try {
    const members = await projectsService.getProjectMembers(parseInt(req.params.id));
    return success(res, members);
  } catch (err) { next(err); }
};

const addMember = async (req, res, next) => {
  try {
    const member = await projectsService.addMember(parseInt(req.params.id), req.body.employeeId, req.user.id);
    return created(res, member, 'Member added successfully');
  } catch (err) { next(err); }
};

const removeMember = async (req, res, next) => {
  try {
    await projectsService.removeMember(parseInt(req.params.id), parseInt(req.params.uid), req.user.id);
    return success(res, null, 'Member removed successfully');
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, update, archive, getMembers, addMember, removeMember };
