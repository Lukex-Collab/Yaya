// pages/journal/journal.js — 手账页逻辑
const { getJournals, createJournal, getMoodStats } = require('../../services/journal');
const api = require('../../services/api');

Page({
  data: {
    activeTab: 'ai',               // ai | user | health
    currentEmotion: 'all',
    journals: [],                  // AI 生成的日记
    userJournals: [],              // 用户手动记录
    isLoading: false,
    draftContent: '',

    // 健康
    periodData: {
      daysUntilNext: null,
      cycleLength: 28,
      currentDay: null,
    },
    bodyNotes: [],
  },

  onShow() {
    if (this.data.activeTab === 'ai') {
      this.loadJournals();
    } else if (this.data.activeTab === 'user') {
      this.loadUserJournals();
    } else if (this.data.activeTab === 'health') {
      this.loadHealthData();
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.value }, () => {
      this.onShow(); // 重新加载对应 Tab 数据
    });
  },

  /** 加载 AI 日记 */
  async loadJournals() {
    this.setData({ isLoading: true });
    try {
      const where = { source: 'ai' };
      if (this.data.currentEmotion !== 'all') where.emotion = this.data.currentEmotion;

      const journals = await getJournals('demo', { emotion: this.data.currentEmotion === 'all' ? undefined : this.data.currentEmotion });
      this.setData({ journals, isLoading: false });
    } catch (err) {
      console.error(err);
      this.setData({ isLoading: false });
    }
  },

  /** 加载用户记录 */
  async loadUserJournals() {
    try {
      const journals = await getJournals('demo', {});
      this.setData({ userJournals: journals.filter(j => j.source === 'user') });
    } catch (err) {
      console.error(err);
    }
  },

  /** 加载健康数据 */
  async loadHealthData() {
    try {
      // 经期数据
      const periods = await api.query('period_records', { userId: 'demo' }, { limit: 5 });
      if (periods.length > 0) {
        const last = periods[0];
        const cycleLength = last.cycleLength || 28;
        const periodDuration = last.endDate ?
          Math.ceil((new Date(last.endDate) - new Date(last.startDate)) / 86400000) : 5;
        const daysSinceStart = Math.ceil((Date.now() - new Date(last.startDate)) / 86400000);
        const daysUntilNext = cycleLength - daysSinceStart;

        this.setData({
          periodData: {
            daysUntilNext: Math.max(0, daysUntilNext),
            cycleLength,
            currentDay: Math.min(daysSinceStart, periodDuration),
          },
        });
      }

      // 身体状态
      const notes = await api.query('body_notes', { userId: 'demo' }, { limit: 10 });
      this.setData({ bodyNotes: notes });
    } catch (err) {
      console.error(err);
    }
  },

  /** 情绪筛选 */
  filterByEmotion(e) {
    const emotion = e.currentTarget.dataset.emotion;
    this.setData({ currentEmotion: emotion }, () => this.loadJournals());
  },

  /** 打开日记详情 */
  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/journal-detail/journal-detail?id=${id}` });
  },

  /** 写日记 */
  onDraftInput(e) {
    this.setData({ draftContent: e.detail.value });
  },

  async submitJournal() {
    const content = this.data.draftContent.trim();
    if (!content) {
      wx.showToast({ title: '写点什么吧～', icon: 'none' });
      return;
    }

    try {
      await createJournal('demo', {
        content,
        title: content.slice(0, 30),
        emotion: 'neutral',
        emoji: '📝',
      });
      wx.showToast({ title: '记录成功！', icon: 'success' });
      this.setData({ draftContent: '' });
      this.loadUserJournals();
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  /** 跳转健康页 */
  goHealth() {
    wx.navigateTo({ url: '/pages/health/health' });
  },

  onPullDownRefresh() {
    this.onShow();
    wx.stopPullDownRefresh();
  },
});
