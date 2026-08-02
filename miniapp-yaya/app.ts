App<IAnyObject>({
  onLaunch() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' });
    }
  },

  globalData: {
    userInfo: null,
    token: '',
  },
});
