const allocationsService = require('./allocations.service');
const { success, created } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const result = await allocationsService.listAllocations(req.query, req.user);
    return success(res, result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const allocation = await allocationsService.createAllocation(req.body, req.user.id, req.user.role);
    return created(res, allocation, 'Allocation created successfully');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const allocation = await allocationsService.updateAllocation(parseInt(req.params.id), req.body, req.user.id, req.user.role);
    return success(res, allocation, 'Allocation updated successfully');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await allocationsService.deleteAllocation(parseInt(req.params.id), req.user.id, req.user.role);
    return success(res, null, 'Allocation deleted successfully');
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };
