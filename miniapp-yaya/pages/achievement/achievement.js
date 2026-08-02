import { getAchievements } from '../../services/achievement';

Page({
  data: {
    achievements: [] as any[],
    totalUnlocked: 0,
    totalCount: 0,
    companionDays: 0,
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const list = await getAchievements();
      const unlocked = list.filter((a: any) => a.unlocked_at).length;
      this.setData({
        achievements: list,
        totalUnlocked: unlocked,
        totalCount: list.length,
      });
    } catch {
      // 使用本地默认数据
      this.setData({
        achievements: [
          { code:'first_chat', name:'初次见面', description:'完成第一次对话', icon_emoji:'💬', tier:1, target:1, progress:1, unlocked_at: new Date().toISOString() },
          { code:'seven_days', name:'七日之约', description:'连续陪伴7天', icon_emoji:'🌟', tier:2, target:7, progress:1, unlocked_at: null },
          { code:'thirty_days', name:'三十天老友', description:'连续陪伴30天', icon_emoji:'💫', tier:3, target:30, progress:1, unlocked_at: null },
          { code:'chatterbox', name:'话匣子', description:'累计对话1000条', icon_emoji:'🗣️', tier:2, target:1000, progress:0, unlocked_at: null },
          { code:'journal_master', name:'日记达人', description:'写满30篇日记', icon_emoji:'📖', tier:2, target:30, progress:0, unlocked_at: null },
          { code:'hundred_days', name:'百天同行', description:'陪伴100天', icon_emoji:'👑', tier:3, target:100, progress:1, unlocked_at: null },
        ],
        totalCount: 6,
        totalUnlocked: 1,
      });
    }
  },
});
