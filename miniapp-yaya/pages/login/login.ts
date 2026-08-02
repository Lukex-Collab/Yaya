import { wechatLogin } from '../../services/auth';
import { setToken } from '../../utils/token';

Page({
  data: { loading: false, isDemo: false },

  onLoad() {
    this.setData({ isDemo: true });
  },

  async handleLogin() {
    this.setData({ loading: true });
    try {
      // 开发模式：使用 'dev' code
      const result = await wechatLogin('dev', '牙牙的朋友', '');
      setToken(result.token);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err: any) {
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
