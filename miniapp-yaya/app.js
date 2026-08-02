// app.js — 灵伴(LingPal) 微信小程序
App({
  onLaunch: function () {
    // 1. 云开发初始化 (可选, 没有也不报错)
    try {
      if (typeof wx !== 'undefined' && wx.cloud) {
        wx.cloud.init({ env: 'yaya-d5gf9yfw20986839f', traceUser: true });
      }
    } catch(e) {
      console.log('CloudBase init skipped:', e.message);
    }

    // 2. 获取系统信息
    try {
      var sys = wx.getSystemInfoSync();
      this.globalData.statusBarHeight = sys.statusBarHeight || 20;
      this.globalData.windowHeight = sys.windowHeight || 600;
    } catch(e) {
      this.globalData.statusBarHeight = 20;
    }

    // 3. 检查登录态
    var token = wx.getStorageSync('token');
    if (token) {
      this.globalData.isLogin = true;
    }
  },

  // 供页面调用的全局方法
  checkLogin: function() {
    return this.globalData.isLogin;
  },

  globalData: {
    isLogin: false,
    userInfo: null,
    statusBarHeight: 20,
    windowHeight: 600,
    companionDays: 1,
    intimacyScore: 0,

    yayaState: {
      mood: 'happy',
      currentEmoji: '🧸',
    },

    deviceConnected: false,
    safetyStatus: 'safe',
  }
});
