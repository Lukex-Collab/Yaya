// pages/journal-detail/journal-detail.js
const { getJournal, deleteJournal } = require('../../services/journal');

Page({
  data: { journal: null },
  onLoad(options) {
    if (options.id) this.loadJournal(options.id);
  },
  async loadJournal(id) {
    try {
      const journal = await getJournal(id);
      this.setData({ journal });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },
  shareJournal() {
    // 生成分享卡片后调用 wx.shareFileMessage 或分享图片
    wx.showToast({ title: '分享卡片生成中...', icon: 'none' });
  },
  async deleteJournal() {
    const res = await wx.showModal({ title: '确认删除', content: '删除后无法恢复哦' });
    if (res.confirm) {
      await deleteJournal(this.data.journal._id);
      wx.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },
});
