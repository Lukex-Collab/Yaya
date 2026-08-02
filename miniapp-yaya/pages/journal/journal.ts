import { getJournalList } from '../../services/journal';
import { getEmotionInfo } from '../../utils/emotion';

Page({
  data: {
    journals: [] as any[],
    currentEmotion: '',
    loading: false,
    emotionList: [
      { key: 'happy', emoji: '😊', label: '开心' },
      { key: 'sad', emoji: '😢', label: '难过' },
      { key: 'anxious', emoji: '😰', label: '焦虑' },
      { key: 'calm', emoji: '😌', label: '平静' },
      { key: 'excited', emoji: '🤩', label: '兴奋' },
      { key: 'tired', emoji: '😴', label: '疲惫' },
    ],
    emotionMap: {} as Record<string, any>,
  },

  onLoad() {
    const map: Record<string, any> = {};
    this.data.emotionList.forEach((e) => {
      map[e.key] = { emoji: e.emoji, label: e.label, color: getEmotionInfo(e.key).color };
    });
    this.setData({ emotionMap: map });
  },

  onShow() {
    this.loadJournals();
  },

  async loadJournals() {
    this.setData({ loading: true });
    try {
      const journals = await getJournalList(this.data.currentEmotion || undefined);
      this.setData({ journals });
    } catch {
      // 静默失败
    } finally {
      this.setData({ loading: false });
    }
  },

  filterBy(e: any) {
    const emotion = e.currentTarget.dataset.emotion || '';
    this.setData({ currentEmotion: emotion });
    this.loadJournals();
  },

  goDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/journal-detail/journal-detail?id=${id}` });
  },

  createJournal() {
    wx.navigateTo({ url: '/pages/journal-detail/journal-detail' });
  },
});
