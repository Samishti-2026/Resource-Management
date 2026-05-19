const exceptionsService = require('./exceptions.service');
const { success, created } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const result = await exceptionsService.listExceptions(req.query, req.user);
    return success(res, result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const exception = await exceptionsService.createException(req.body, req.user.id);
    return created(res, exception, 'Exception request submitted');
  } catch (err) { next(err); }
};

const approve = async (req, res, next) => {
  try {
    const exception = await exceptionsService.approveException(parseInt(req.params.id), req.user.id);
    return success(res, exception, 'Exception request approved');
  } catch (err) { next(err); }
};

const reject = async (req, res, next) => {
  try {
    const exception = await exceptionsService.rejectException(parseInt(req.params.id), req.user.id);
    return success(res, exception, 'Exception request rejected');
  } catch (err) { next(err); }
};

module.exports = { list, create, approve, reject };
