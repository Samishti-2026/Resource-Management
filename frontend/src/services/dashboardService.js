import api from './api';
import { API } from '../constants/api';

export const getEmployeeDashboard = () =>
  api.get(API.DASHBOARD.EMPLOYEE).then((r) => r.data.data);

export const getPMDashboard = () =>
  api.get(API.DASHBOARD.PM).then((r) => r.data.data);

export const getRMDashboard = () =>
  api.get(API.DASHBOARD.RM).then((r) => r.data.data);
