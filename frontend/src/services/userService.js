import api from './api';
import { API } from '../constants/api';

export const getUsers = (params) =>
  api.get(API.USERS.BASE, { params }).then((r) => r.data.data);

export const getUserById = (id) =>
  api.get(API.USERS.BY_ID(id)).then((r) => r.data.data);

export const createUser = (data) =>
  api.post(API.USERS.BASE, data).then((r) => r.data.data);

export const updateUser = (id, data) =>
  api.patch(API.USERS.BY_ID(id), data).then((r) => r.data.data);

export const deleteUser = (id) =>
  api.delete(API.USERS.BY_ID(id)).then((r) => r.data.data);

export const getRoles = () =>
  api.get(API.USERS.ROLES).then((r) => r.data.data);

export const assignSkills = (id, skillIds) =>
  api.post(API.USERS.SKILLS(id), { skillIds }).then((r) => r.data.data);
