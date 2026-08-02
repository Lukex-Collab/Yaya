// 手账页 — 牙牙日记 + 我的记录 + 健康追踪
const http = require('../../services/http');

Page({
  data: {
    activeTab: 'ai',
    currentEmotion: 'all',
    journals: [],
    userJournals: [],
    isLoading: false,
    draftContent: '',
    periodData: { daysUntilNext: 0, cycleLength: 28 },
    bodyNotes: [],
  },

  onShow() {
    const tab = this.data.activeTab;
    if (tab === 'ai') this.loadJournals();
    else if (tab === 'user') this.loadUserJournals();
    else if (tab === 'health') this.loadHealthData();
  },

  async loadJournals() {
    this.setData({ isLoading: true });
    try {
      let path = '/journal/list?pageSize=20';
      if (this.data.currentEmotion !== 'all') path += '&emotion=' + this.data.currentEmotion;
      const journals = await http.get(path);
      this.setData({ journals: journals || [], isLoading: false });
    } catch(e) { this.setData({ isLoading: false }); }
  },

  async loadUserJournals() {
    try { this.setData({ userJournals: (await http.get('/journal/list')).filter(j => j.source === 'user') || []); } catch(e) {}
  },

  async loadHealthData() {
    try {
      const calendar = await http.get('/health/period/calendar');
      if (calendar && calendar.length > 0) {
        const last = calendar[0];
        const daysSince = Math.ceil((Date.now() - new Date(last.start_date)) / 86400000);
        this.setData({ periodData: { daysUntilNext: Math.max(0, (last.cycle_length || 28) - daysSince), cycleLength: last.cycle_length || 28 } });
      }
      const notes = await http.get('/health/body-notes?limit=10');
      this.setData({ bodyNotes: notes || [] });
    } catch(e) {}
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.value });
    this.onShow();
  },

  filterByEmotion(e) {
    this.setData({ currentEmotion: e.currentTarget.dataset.emotion });
    this.loadJournals();
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/journal-detail/journal-detail?id=' + id });
  },

  onDraftInput(e) { this.setData({ draftContent: e.detail.value }); },

  async submitJournal() {
    const content = this.data.draftContent.trim();
    if (!content) return wx.showToast({ title: '写点什么吧～', icon: 'none' });
    try {
      await http.post('/journal/create', { content, is_private: false });
      wx.showToast({ title: '记录成功！', icon: 'success' });
      this.setData({ draftContent: '' });
      this.loadUserJournals();
    } catch(e) { wx.showToast({ title: '保存失败', icon: 'none' }); }
  },

  goHealth() { wx.navigateTo({ url: '/pages/health/health' }); },
  onPullDownRefresh() { this.onShow(); wx.stopPullDownRefresh(); },
});
