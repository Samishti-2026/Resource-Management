import api from './api';
import { API } from '../constants/api';

export const getExceptions = (params) =>
  api.get(API.EXCEPTIONS.BASE, { params }).then((r) => r.data.data);

export const createException = (data) =>
  api.post(API.EXCEPTIONS.BASE, data).then((r) => r.data.data);

export const approveException = (id) =>
  api.post(API.EXCEPTIONS.APPROVE(id)).then((r) => r.data.data);

export const rejectException = (id) =>
  api.post(API.EXCEPTIONS.REJECT(id)).then((r) => r.data.data);
