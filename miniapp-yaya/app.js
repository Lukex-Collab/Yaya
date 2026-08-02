// app.js — 牙牙 AI 守护玩偶
const APP_CONFIG = require('./utils/constants');

App({
  onLaunch: function () {
    // 1. 初始化云开发
    if (!wx.cloud) {
      console.error('请使用基础库 >= 2.2.3，并确保已开通云开发');
      return;
    }

    wx.cloud.init({
      env: 'yaya-d5gf9yfw20986839f',
      traceUser: true,
    });

    // 2. 检查登录态
    this.checkLogin();

    // 3. 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    this.globalData.systemInfo = systemInfo;
    this.globalData.statusBarHeight = systemInfo.statusBarHeight;
  },

  /**
   * 检查微信登录态
   */
  async checkLogin() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userLogin',
      });
      this.globalData.userInfo = res.result.user;
      this.globalData.isLogin = true;
    } catch (err) {
      console.warn('登录失败，将以游客模式运行', err);
      this.globalData.isLogin = false;
    }
  },

  globalData: {
    isLogin: false,
    userInfo: null,
    systemInfo: null,
    statusBarHeight: 20,
    companionDays: 1,
    intimacyScore: 0,

    // 牙牙当前状态
    yayaState: {
      mood: 'happy',           // happy, sleepy, worried, excited, coquettish, guarding
      currentEmoji: '😊',
      lastInteraction: null,
    },

    // 设备连接状态
    deviceConnected: false,
    safetyStatus: 'safe',      // safe, alert, offline
  },
});
