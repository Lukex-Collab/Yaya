import { getProfile } from '../../services/auth';
import { clearToken } from '../../utils/token';

Page({
  data: {
    user: null as any,
    yayaNickname: '牙牙',
    companionDays: 0,
    personalitySeed: 0,
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    try {
      const user = await getProfile();
      this.setData({
        user,
        yayaNickname: user.yaya_nickname || '牙牙',
        companionDays: user.companion_days,
        personalitySeed: user.yaya_personality_seed,
      });
    } catch {
      // 静默失败，示默认值
    }
  },

  goToAchievement() {
    wx.navigateTo({ url: '/pages/achievement/achievement' });
  },

  goToSafety() {
    wx.navigateTo({ url: '/pages/safety/safety' });
  },

  goToHealth() {
    wx.navigateTo({ url: '/pages/health/health' });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出吗？',
      success: (res) => {
        if (res.confirm) {
          clearToken();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },
});
