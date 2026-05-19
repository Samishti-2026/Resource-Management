const holidaysService = require('./holidays.service');
const { success, created } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const holidays = await holidaysService.listHolidays(req.query);
    return success(res, holidays);
  } catch (err) { next(err); }
};

const bulkCreate = async (req, res, next) => {
  try {
    const holidays = await holidaysService.bulkCreateHolidays(req.body.holidays, req.user.id);
    return created(res, holidays, `${holidays.length} holidays saved`);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await holidaysService.deleteHoliday(parseInt(req.params.id), req.user.id);
    return success(res, null, 'Holiday deleted');
  } catch (err) { next(err); }
};

module.exports = { list, bulkCreate, remove };
