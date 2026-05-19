const usersService = require('./users.service');
const { success, created, notFound } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const result = await usersService.listUsers(req.query);
    return success(res, result);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const user = await usersService.getUserById(parseInt(req.params.id));
    return success(res, user);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const user = await usersService.createUser(req.body, req.user.id);
    return created(res, user, 'User created successfully');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const user = await usersService.updateUser(parseInt(req.params.id), req.body, req.user.id);
    return success(res, user, 'User updated successfully');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await usersService.deleteUser(parseInt(req.params.id), req.user.id);
    return success(res, null, 'User deactivated successfully');
  } catch (err) { next(err); }
};

const assignSkills = async (req, res, next) => {
  try {
    await usersService.assignSkills(parseInt(req.params.id), req.body.skillIds, req.user.id);
    return success(res, null, 'Skills assigned successfully');
  } catch (err) { next(err); }
};

const getRoles = async (req, res, next) => {
  try {
    const roles = await usersService.listRoles();
    return success(res, roles);
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, update, remove, assignSkills, getRoles };
