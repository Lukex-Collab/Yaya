import { getJournalDetail, deleteJournal } from '../../services/journal';

Page({
  data: {
    journal: null as any,
    id: '',
  },

  onLoad(options: any) {
    if (options.id) {
      this.setData({ id: options.id });
      this.loadDetail(options.id);
    }
  },

  async loadDetail(id: string) {
    try {
      const journal = await getJournalDetail(id);
      this.setData({ journal: {
        ...journal,
        emoji: '📖',
        date: journal.created_at,
        wordCount: journal.word_count,
      }});
    } catch {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async deleteJournal() {
    if (!this.data.id) return;
    const confirm = await wx.showModal({ title: '删除日记', content: '确定要删除吗？' });
    if (!confirm.confirm) return;

    try {
      await deleteJournal(this.data.id);
      wx.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  shareJournal() {
    // 分享功能
  },
});
