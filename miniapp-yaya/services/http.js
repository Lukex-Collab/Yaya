// services/http.js — 统一 HTTP 客户端
// 双模式: CloudBase云函数(开发) / Go后端(生产)
// 优先级: 如果有 token 且 Go 后端在线 → 用 Go
//          否则 → 降级到 CloudBase 云函数
const app = getApp();

// Go 后端地址（部署后修改）
const GO_BASE = 'https://api.lingpal.com';

// CloudBase 云函数（开发模式）
const CLOUD_FUNCTIONS = {
  login:    'userLogin',
  chat:     'aiChat',
  memory:   'memoryIngest',
  memorySearch: 'memoryIngest',
  push:     'pushSchedule',
};

/**
 * 通用请求 — 优先 Go 后端, 降级 CloudBase
 */
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token') || '';

    // 尝试 Go 后端
    wx.request({
      url: GO_BASE + '/api/v1' + path,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : '',
      },
      timeout: 5000, // 5秒超时
      success(res) {
        if (res.statusCode === 401) {
          wx.removeStorageSync('token');
          wx.reLaunch({ url: '/pages/login/login' });
          reject(new Error('登录已过期'));
          return;
        }
        if (res.data && res.data.code === 0) {
          resolve(res.data.data);
        } else {
          reject(new Error(res.data?.msg || '请求失败'));
        }
      },
      fail() {
        // Go后端不可用 → 降级 CloudBase 云函数
        cloudFallback(method, path, data).then(resolve).catch(reject);
      },
    });
  });
}

// CloudBase 云函数降级
async function cloudFallback(method, path, data) {
  if (!wx.cloud) throw new Error('CloudBase 未初始化');

  // 路由 → 云函数映射
  if (path === '/auth/wechat/login') {
    const res = await wx.cloud.callFunction({ name: CLOUD_FUNCTIONS.login, data: { code: data?.code || 'dev', nickname: data?.nickname || '牙牙的朋友' } });
    return res.result?.user ? { token: 'cloud-' + Date.now(), user: res.result.user, is_new: false } : null;
  }
  if (path === '/chat/send') {
    const res = await wx.cloud.callFunction({ name: CLOUD_FUNCTIONS.chat, data: { content: data.content } });
    return res.result;
  }
  if (path === '/user/profile') {
    return { nickname: '牙牙的朋友', companion_days: 1, yaya_nickname: '牙牙' };
  }

  throw new Error('功能暂未开放');
}

// 便捷方法
const http = {
  get: (path) => request('GET', path),
  post: (path, data) => request('POST', path, data),
  put: (path, data) => request('PUT', path, data),
  del: (path) => request('DELETE', path),

  // 微信登录
  login: async (code, nickname) => {
    return new Promise((resolve, reject) => {
      // 先试 Go 后端
      wx.request({
        url: GO_BASE + '/api/v1/auth/wechat/login',
        method: 'POST',
        data: { code: code || 'dev', nickname: nickname || '牙牙的朋友' },
        header: { 'Content-Type': 'application/json' },
        timeout: 5000,
        success(res) {
          if (res.data?.code === 0 && res.data?.data?.token) {
            wx.setStorageSync('token', res.data.data.token);
            app.globalData.userInfo = res.data.data.user;
            app.globalData.isLogin = true;
            resolve(res.data.data);
            return;
          }
          // Go 后端返回错误 → 用 CloudBase
          wx.cloud.callFunction({ name: CLOUD_FUNCTIONS.login, data: { code: code || 'dev' } }).then(r => {
            const token = 'cloud-' + Date.now();
            wx.setStorageSync('token', token);
            app.globalData.isLogin = true;
            resolve({ token, user: r.result?.user || { nickname }, is_new: false });
          }).catch(reject);
        },
        fail() {
          // Go 后端不可用 → CloudBase
          wx.cloud.callFunction({ name: CLOUD_FUNCTIONS.login, data: { code: code || 'dev' } }).then(r => {
            const token = 'cloud-' + Date.now();
            wx.setStorageSync('token', token);
            app.globalData.isLogin = true;
            resolve({ token, user: r.result?.user || { nickname: '牙牙的朋友' }, is_new: true });
          }).catch(reject);
        },
      });
    });
  },

  // SSE 流式对话
  chatStream(content, convId, onToken, onDone, onError) {
    const token = wx.getStorageSync('token') || '';
    wx.request({
      url: GO_BASE + '/api/v1/chat/send',
      method: 'POST',
      data: { content, conversation_id: convId || '' },
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      enableChunked: true,
      timeout: 30000,
      success: () => {},
      fail(err) {
        // 降级 CloudBase
        wx.cloud.callFunction({ name: CLOUD_FUNCTIONS.chat, data: { content } }).then(r => {
          if (onToken) onToken(r.result?.reply || '牙牙在呢～');
          if (onDone) onDone('');
        }).catch(onError || (() => {}));
      },
    });
    // SSE parsing handled by enableChunked + onChunkReceived
    const task = wx.request({
      url: GO_BASE + '/api/v1/chat/send',
      method: 'POST',
      data: { content, conversation_id: convId || '' },
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      enableChunked: true,
      timeout: 30000,
      success: () => {},
      fail: () => {
        wx.cloud.callFunction({ name: CLOUD_FUNCTIONS.chat, data: { content } }).then(r => {
          if (onToken) onToken(r.result?.reply || '牙牙在呢～');
        }).catch(onError);
      },
    });
    task.onChunkReceived((res) => {
      const text = res.data;
      try {
        const event = JSON.parse(text.replace('data: ', ''));
        if (event.content && onToken) onToken(event.content);
        if (event.done && onDone) onDone(event.conv_id);
        if (event.error && onError) onError(new Error(event.error));
      } catch(e) {}
    });
    return task;
  },
};

module.exports = http;
