const timesheetsService = require('./timesheets.service');
const { success, created, badRequest } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const result = await timesheetsService.listTimesheets(req.query, req.user);
    return success(res, result);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const ts = await timesheetsService.getTimesheetById(parseInt(req.params.id), req.user);
    return success(res, ts);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const ts = await timesheetsService.upsertTimesheet(req.user.id, req.body.weekStart);
    return created(res, ts, 'Timesheet created');
  } catch (err) { next(err); }
};

const saveEntries = async (req, res, next) => {
  try {
    const ts = await timesheetsService.saveEntries(
      parseInt(req.params.id),
      req.body.entries,
      req.user.id,
      req.body.remarks,
    );
    return success(res, ts, 'Entries saved');
  } catch (err) { next(err); }
};

const submit = async (req, res, next) => {
  try {
    const ts = await timesheetsService.submitTimesheet(parseInt(req.params.id), req.user.id);
    return success(res, ts, 'Timesheet submitted successfully');
  } catch (err) {
    if (err.validationErrors) {
      return res.status(422).json({
        success: false,
        message: err.message,
        validationErrors: err.validationErrors,
      });
    }
    next(err);
  }
};

const approve = async (req, res, next) => {
  try {
    const ts = await timesheetsService.approveTimesheet(
      parseInt(req.params.id),
      req.user.id,
      req.body.remarks,
    );
    return success(res, ts, 'Timesheet approved');
  } catch (err) { next(err); }
};

const reject = async (req, res, next) => {
  try {
    const ts = await timesheetsService.rejectTimesheet(parseInt(req.params.id), req.body.reason, req.user.id);
    return success(res, ts, 'Timesheet rejected');
  } catch (err) { next(err); }
};

const copyPrevious = async (req, res, next) => {
  try {
    const ts = await timesheetsService.copyPreviousWeek(parseInt(req.params.id), req.user.id);
    return success(res, ts, 'Previous week copied');
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, saveEntries, submit, approve, reject, copyPrevious };
