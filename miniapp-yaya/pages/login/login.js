// 微信一键登录页
const http = require('../../services/http');
const app = getApp();

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    canLogin: false,
    loginText: '微信一键登录',
  },

  onLoad() {
    // 检查是否已登录
    if (wx.getStorageSync('token')) {
      wx.switchTab({ url: '/pages/home/home' });
    }
  },

  // 获取微信用户信息
  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value, canLogin: !!e.detail.value });
  },

  // 微信登录
  async handleLogin() {
    this.setData({ loginText: '登录中...' });
    try {
      // 1. 获取微信 code
      const loginRes = await wx.login();
      const code = loginRes.code;

      // 2. 发送 code 到后端换取 token
      const result = await http.login(code, this.data.nickname || '牙牙的朋友');

      wx.showToast({ title: result.is_new ? '欢迎来到牙牙的世界！🧸' : '欢迎回来～', icon: 'none' });
      setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1200);
    } catch(err) {
      console.error('[login]', err);
      this.setData({ loginText: '微信一键登录' });
      // 开发模式: 使用 mock token
      wx.setStorageSync('token', 'dev-token');
      wx.switchTab({ url: '/pages/home/home' });
    }
  },

  // 游客模式
  skipLogin() {
    wx.setStorageSync('token', 'dev-token');
    wx.switchTab({ url: '/pages/home/home' });
  },
});
