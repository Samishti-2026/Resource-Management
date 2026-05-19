import api from './api';
import { API } from '../constants/api';

export const getAllocations = (params) =>
  api.get(API.ALLOCATIONS.BASE, { params }).then((r) => r.data.data);

export const createAllocation = (data) =>
  api.post(API.ALLOCATIONS.BASE, data).then((r) => r.data.data);

export const updateAllocation = (id, data) =>
  api.patch(API.ALLOCATIONS.BY_ID(id), data).then((r) => r.data.data);

export const deleteAllocation = (id) =>
  api.delete(API.ALLOCATIONS.BY_ID(id)).then((r) => r.data.data);
