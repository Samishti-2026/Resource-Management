import api from './api';
import { API } from '../constants/api';

export const login = async (email, password) => {
  const { data } = await api.post(API.AUTH.LOGIN, { email, password });
  if (data.data.refreshToken) {
    localStorage.setItem('refreshToken', data.data.refreshToken);
  }
  return data.data;
};

export const logout = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  try {
    await api.post(API.AUTH.LOGOUT, { refreshToken });
  } finally {
    localStorage.removeItem('refreshToken');
  }
};

export const getMe = async () => {
  const { data } = await api.get(API.AUTH.ME);
  return data.data;
};
