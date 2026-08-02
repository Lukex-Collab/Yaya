// app.js — 灵伴(LingPal) 微信小程序入口
// 双模式: 牙牙(AI陪伴) + 灵伴世界(3D宠物)
// 后端: Go/Gin API Gateway (40微服务·144+端点)

App({
  onLaunch: function () {
    // 1. 初始化云开发 (如果有的话)
    if (wx.cloud) {
      try {
        wx.cloud.init({ env: 'yaya-d5gf9yfw20986839f', traceUser: true });
      } catch(e) { console.warn('云开发初始化失败(可能未开通):', e.message); }
    }

    // 2. 获取系统信息
    const sys = wx.getSystemInfoSync();
    this.globalData.systemInfo = sys;
    this.globalData.statusBarHeight = sys.statusBarHeight;
    this.globalData.windowHeight = sys.windowHeight;

    // 3. 检查登录
    this.checkLogin();
  },

  // 检查登录状态
  async checkLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.globalData.isLogin = false;
      return;
    }
    // 验证 token 有效性
    try {
      const http = require('./services/http');
      const user = await http.get('/user/profile');
      this.globalData.userInfo = user;
      this.globalData.isLogin = true;
      this.globalData.companionDays = user.companion_days || 1;
    } catch(err) {
      console.warn('Token 无效, 需重新登录');
      wx.removeStorageSync('token');
      this.globalData.isLogin = false;
    }
  },

  globalData: {
    isLogin: false,
    userInfo: null,
    systemInfo: null,
    statusBarHeight: 20,
    windowHeight: 600,
    companionDays: 1,
    intimacyScore: 0,

    // 牙牙状态
    yayaState: {
      mood: 'happy',
      currentEmoji: '🧸',
      lastInteraction: null,
    },

    // 设备/安全
    deviceConnected: false,
    safetyStatus: 'safe',
  },
});
