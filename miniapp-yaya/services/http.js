// services/http.js — 统一 HTTP 客户端
// 注意: getApp() 不放在顶层, 避免模块加载时序问题
const BASE_URL = 'https://api.lingpal.com';

function getAppSafe() {
  try { return getApp(); } catch(e) { return { globalData: {} }; }
}

/**
 * 通用请求 (带 JWT)
 */
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token') || '';
    wx.request({
      url: BASE_URL + '/api/v1' + path,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : '',
      },
      success(res) {
        if (res.statusCode === 401) {
          // token 过期 → 重新登录
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
      fail(err) {
        console.error('[http]', method, path, err);
        reject(err);
      },
    });
  });
}

// 便捷方法
const http = {
  get: (path) => request('GET', path),
  post: (path, data) => request('POST', path, data),
  put: (path, data) => request('PUT', path, data),
  del: (path) => request('DELETE', path),

  // 登录（无需 token）
  login: (code, nickname) => new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + '/api/v1/auth/wechat/login',
      method: 'POST',
      data: { code, nickname },
      header: { 'Content-Type': 'application/json' },
      success(res) {
        if (res.data?.code === 0 && res.data?.data?.token) {
          wx.setStorageSync('token', res.data.data.token);
          getAppSafe().globalData.userInfo = res.data.data.user;
          app.globalData.isLogin = true;
          resolve(res.data.data);
        } else {
          reject(new Error(res.data?.msg || '登录失败'));
        }
      },
      fail: reject,
    });
  }),

  // SSE 流式对话
  chatStream(content, convId, onToken, onDone, onError) {
    const token = wx.getStorageSync('token') || '';
    const task = wx.request({
      url: BASE_URL + '/api/v1/chat/send',
      method: 'POST',
      data: { content, conversation_id: convId || '' },
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      enableChunked: true, // 开启分块传输（SSE）
      success: () => {},
      fail: onError,
    });

    let buffer = '';
    task.onChunkReceived((res) => {
      const text = res.data;
      buffer += text;
      // 解析 SSE: data: {...}\n\n
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) onToken(event.content);
            if (event.done) { onDone(event.conv_id); return; }
            if (event.error) onError(new Error(event.error));
          } catch(e) {}
        }
      }
    });
    return task;
  },
};

module.exports = http;
