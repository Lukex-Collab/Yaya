// 日记详情页
const http = require('../../services/http');

Page({
  data: { journal: null },
  onLoad(options) {
    if (options.id) this.loadJournal(options.id);
  },
  async loadJournal(id) {
    try {
      const journal = await http.get('/journal/' + id);
      this.setData({ journal });
    } catch(e) { wx.showToast({ title: '加载失败', icon: 'none' }); }
  },
  shareJournal() {
    http.post('/share/journal/' + this.data.journal.id, {}).catch(() => {});
    wx.showToast({ title: '分享卡片生成中...', icon: 'none' });
  },
  async deleteJournal() {
    const res = await wx.showModal({ title: '确认删除', content: '删除后无法恢复哦' });
    if (res.confirm) {
      try {
        await http.del('/journal/' + this.data.journal.id);
        wx.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1500);
      } catch(e) {}
    }
  },
});
