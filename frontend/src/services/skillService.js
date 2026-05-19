import api from './api';
import { API } from '../constants/api';

export const getSkills = () =>
  api.get(API.SKILLS.BASE).then((r) => r.data.data);

export const createSkill = (data) =>
  api.post(API.SKILLS.BASE, data).then((r) => r.data.data);

export const updateSkill = (id, data) =>
  api.patch(API.SKILLS.BY_ID(id), data).then((r) => r.data.data);

export const deleteSkill = (id) =>
  api.delete(API.SKILLS.BY_ID(id)).then((r) => r.data.data);
