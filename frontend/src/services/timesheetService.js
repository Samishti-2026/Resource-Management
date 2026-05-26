import api from './api';
import { API } from '../constants/api';

export const getTimesheets = (params) =>
  api.get(API.TIMESHEETS.BASE, { params }).then((r) => r.data.data);

export const getTimesheetById = (id) =>
  api.get(API.TIMESHEETS.BY_ID(id)).then((r) => r.data.data);

export const createTimesheet = (weekStart) =>
  api.post(API.TIMESHEETS.BASE, { weekStart }).then((r) => r.data.data);

export const saveEntries = (id, entries, remarks) =>
  api.patch(API.TIMESHEETS.BY_ID(id), { entries, remarks }).then((r) => r.data.data);

export const submitTimesheet = (id) =>
  api.post(API.TIMESHEETS.SUBMIT(id)).then((r) => r.data.data);

export const approveTimesheet = (id, remarks) =>
  api.post(API.TIMESHEETS.APPROVE(id), { remarks }).then((r) => r.data.data);

export const rejectTimesheet = (id, reason) =>
  api.post(API.TIMESHEETS.REJECT(id), { reason }).then((r) => r.data.data);

export const copyPreviousWeek = (id) =>
  api.post(API.TIMESHEETS.COPY_PREVIOUS(id)).then((r) => r.data.data);
