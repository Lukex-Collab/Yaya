const { getAllMemories, deleteMemory, toggleLockMemory } = require('../../services/memory');

Page({
  data: { memories: [] },
  onShow() { this.loadMemories(); },
  async loadMemories() {
    const memories = await getAllMemories('demo');
    this.setData({ memories });
  },
  async deleteMemory(e) {
    const id = e.currentTarget.dataset.id;
    await deleteMemory(id);
    wx.showToast({ title: '已删除', icon: 'success' });
    this.loadMemories();
  },
  async toggleLock(e) {
    const { id, locked } = e.currentTarget.dataset;
    await toggleLockMemory(id, !locked);
    wx.showToast({ title: locked ? '已解锁' : '已锁定', icon: 'none' });
    this.loadMemories();
  },
});
