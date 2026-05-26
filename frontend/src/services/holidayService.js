import api from './api';
import { API } from '../constants/api';

export const getHolidays = (params) =>
  api.get(API.HOLIDAYS.BASE, { params }).then((r) => r.data.data);

export const bulkCreateHolidays = (holidays) =>
  api.post(API.HOLIDAYS.BULK, { holidays }).then((r) => r.data.data);

export const deleteHoliday = (id) =>
  api.delete(API.HOLIDAYS.BY_ID(id)).then((r) => r.data.data);

export const uploadHolidaysExcel = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(API.HOLIDAYS.UPLOAD, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data.data);
};
