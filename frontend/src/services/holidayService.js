import api from './api';
import { API } from '../constants/api';

export const getHolidays = (params) =>
  api.get(API.HOLIDAYS.BASE, { params }).then((r) => r.data.data);

export const bulkCreateHolidays = (holidays) =>
  api.post(API.HOLIDAYS.BULK, { holidays }).then((r) => r.data.data);

export const deleteHoliday = (id) =>
  api.delete(API.HOLIDAYS.BY_ID(id)).then((r) => r.data.data);
