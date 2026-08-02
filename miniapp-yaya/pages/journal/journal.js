// 手账页
var http = require('../../services/http');

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

  onShow: function () {
    if (this.data.activeTab === 'ai') this.loadJournals();
    else if (this.data.activeTab === 'user') this.loadUserJournals();
    else if (this.data.activeTab === 'health') this.loadHealthData();
  },

  onTabChange: function (e) {
    this.setData({ activeTab: e.detail.value });
    this.onShow();
  },

  async loadJournals() {
    this.setData({ isLoading: true });
    try {
      var path = '/journal/list?pageSize=20';
      if (this.data.currentEmotion !== 'all') path += '&emotion=' + this.data.currentEmotion;
      var result = await http.get(path);
      this.setData({ journals: result || [], isLoading: false });
    } catch (e) {
      this.setData({ isLoading: false });
    }
  },

  async loadUserJournals() {
    try {
      var all = await http.get('/journal/list');
      var userOnes = (all || []).filter(function (j) { return j.source === 'user'; });
      this.setData({ userJournals: userOnes });
    } catch (e) {}
  },

  async loadHealthData() {
    try {
      var calendar = await http.get('/health/period/calendar');
      if (calendar && calendar.length > 0) {
        var last = calendar[0];
        var daysSince = Math.ceil((Date.now() - new Date(last.start_date)) / 86400000);
        this.setData({
          periodData: {
            daysUntilNext: Math.max(0, (last.cycle_length || 28) - daysSince),
            cycleLength: last.cycle_length || 28
          }
        });
      }
      var notes = await http.get('/health/body-notes?limit=10');
      this.setData({ bodyNotes: notes || [] });
    } catch (e) {}
  },

  filterByEmotion: function (e) {
    this.setData({ currentEmotion: e.currentTarget.dataset.emotion });
    this.loadJournals();
  },

  openDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/journal-detail/journal-detail?id=' + id });
  },

  onDraftInput: function (e) {
    this.setData({ draftContent: e.detail.value });
  },

  async submitJournal() {
    var content = this.data.draftContent.trim();
    if (!content) {
      wx.showToast({ title: '写点什么吧~', icon: 'none' });
      return;
    }
    try {
      await http.post('/journal/create', { content: content, is_private: false });
      wx.showToast({ title: '记录成功！', icon: 'success' });
      this.setData({ draftContent: '' });
      this.loadUserJournals();
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  goHealth: function () {
    wx.navigateTo({ url: '/pages/health/health' });
  },

  onPullDownRefresh: function () {
    this.onShow();
    wx.stopPullDownRefresh();
  },
});
