import api from './api';
import { API } from '../constants/api';

export const getProjects = (params) =>
  api.get(API.PROJECTS.BASE, { params }).then((r) => r.data.data);

export const getProjectById = (id) =>
  api.get(API.PROJECTS.BY_ID(id)).then((r) => r.data.data);

export const createProject = (data) =>
  api.post(API.PROJECTS.BASE, data).then((r) => r.data.data);

export const updateProject = (id, data) =>
  api.patch(API.PROJECTS.BY_ID(id), data).then((r) => r.data.data);

export const archiveProject = (id) =>
  api.patch(API.PROJECTS.ARCHIVE(id)).then((r) => r.data.data);

export const getProjectMembers = (id) =>
  api.get(API.PROJECTS.MEMBERS(id)).then((r) => r.data.data);

export const addProjectMember = (id, employeeId) =>
  api.post(API.PROJECTS.MEMBERS(id), { employeeId }).then((r) => r.data.data);

export const removeProjectMember = (id, uid) =>
  api.delete(API.PROJECTS.MEMBER(id, uid)).then((r) => r.data.data);
