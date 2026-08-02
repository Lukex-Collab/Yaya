const { getMoodStats } = require('../../services/journal');

Page({
  data: {
    weeklyMoods: [],
    insights: ['你通常在周三下午情绪最低', '和亲近的人聊天后情绪提升最明显', '睡前1小时情绪最稳定'],
    rescueActions: [
      { emoji:'🤗', label:'牙牙抱抱', action:'hug' },
      { emoji:'🌬️', label:'深呼吸', action:'breathe' },
      { emoji:'🎵', label:'白噪音', action:'whitenoise' },
      { emoji:'💬', label:'倾诉模式', action:'vent' },
    ],
  },
  onShow() { this.loadMoods(); },
  async loadMoods() {
    try {
      const stats = await getMoodStats('demo', 'week');
      const dayNames = ['日','一','二','三','四','五','六'];
      const weekly = stats.timeline.slice(-7).map((t, i) => {
        const emotionMap = { happy:1, excited:0.9, calm:0.7, neutral:0.5, anxious:0.3, sad:0.2, tired:0.1 };
        return { date:t.date, emoji:t.emoji||'💭', value:emotionMap[t.emotion]||0.5, label:dayNames[new Date(t.date).getDay()] };
      });
      this.setData({ weeklyMoods: weekly });
    } catch (err) { console.error(err); }
  },
  doRescue(e) {
    const action = e.currentTarget.dataset.action;
    const hints = { hug:'牙牙紧紧地抱住你 🤗', breathe:'跟着牙牙一起深呼吸吧...吸——呼——', whitenoise:'正在播放雨声白噪音 🌧️', vent:'牙牙在听，你说吧...' };
    wx.showToast({ title: hints[action] || '', icon: 'none', duration: 2000 });
  },
  viewMonthlyReport() { wx.showToast({ title: '月度报告', icon: 'none' }); },
});
