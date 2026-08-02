import { API_BASE } from '../config/api';

const getToken = (): string => wx.getStorageSync('token') || '';

export function request<T>(url: string, options: {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  auth?: boolean;
} = {}): Promise<T> {
  const { method = 'GET', data, auth = true } = options;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(auth && { Authorization: `Bearer ${getToken()}` }),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data as any;
          if (body.code === 0) {
            resolve(body.data);
          } else {
            reject(new Error(body.msg || 'request failed'));
          }
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('token');
          wx.redirectTo({ url: '/pages/login/login' });
          reject(new Error('unauthorized'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg));
      },
    });
  });
}
