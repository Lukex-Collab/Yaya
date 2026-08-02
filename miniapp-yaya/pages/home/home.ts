import { getProfile } from '../../services/auth';
import { getMoodStats } from '../../services/journal';
import { goodMorning, goodNight } from '../../services/ritual';
import { getEmotionInfo } from '../../utils/emotion';

Page({
  data: {
    yayaName: '牙牙',
    status: 'online',
    statusText: '在等你呢',
    companionDays: 1,
    greeting: '今天又是元气满满的一天！',
    moodBars: [] as any[],
    showHint: true,
  },

  onLoad() { this.loadData(); },

  onShow() {
    // 每次回到首页刷新
    this.loadData();
  },

  async loadData() {
    try {
      const user = await getProfile();
      this.setData({
        yayaName: user.yaya_nickname || '牙牙',
        companionDays: user.companion_days,
        status: 'online',
        statusText: '在等你呢',
        greeting: `${user.yaya_nickname || '牙牙'}在等你哦~ 今天想做什么？`,
      });
    } catch {}

    try {
      const stats = await getMoodStats('30 days');
      const total = Object.values(stats).reduce((a: number, b: number) => a + b, 0) || 1;
      const bars = Object.entries(stats).map(([key, count]) => {
        const info = getEmotionInfo(key);
        return {
          label: key,
          emoji: info.emoji,
          color: info.color,
          count: count as number,
          percent: Math.round((count as number / total) * 100),
        };
      });
      this.setData({ moodBars: bars });
    } catch {}
  },

  goChat() {
    this.setData({ showHint: false });
    wx.navigateTo({ url: '/pages/chat/chat' });
  },

  goJournal() {
    wx.switchTab({ url: '/pages/journal/journal' });
  },

  async goodMorning() {
    try {
      const result = await goodMorning();
      this.setData({ greeting: result.greeting });
      wx.showToast({ title: '早安！☀️', icon: 'none' });
    } catch {
      wx.showToast({ title: '网络开小差了', icon: 'none' });
    }
  },

  async goodNight() {
    try {
      const result = await goodNight();
      this.setData({ greeting: result.greeting });
      wx.showToast({ title: '晚安 🌙', icon: 'none' });
    } catch {
      wx.showToast({ title: '网络开小差了', icon: 'none' });
    }
  },
});
