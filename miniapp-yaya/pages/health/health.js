import { getPeriodCalendar, recordPeriod, addBodyNote, getBodyNotes } from '../../services/health';

Page({
  data: {
    records: [] as any[],
    bodyNotes: [] as any[],
    prediction: { nextIn: 0, cycleLength: 28 },
    calendarDays: [] as any[],
    bodyChecks: [
      { key: 'sleep', label: '睡眠充足 😴', checked: false },
      { key: 'water', label: '喝够8杯水 💧', checked: false },
      { key: 'exercise', label: '运动30分钟 🏃‍♀️', checked: false },
      { key: 'mood', label: '心情不错 😊', checked: false },
      { key: 'meals', label: '三餐规律 🍽️', checked: false },
    ],
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const records = await getPeriodCalendar();
      this.setData({ records });
      if (records.length > 0) {
        const last = records[0];
        this.setData({
          prediction: {
            nextIn: 0,
            cycleLength: last.cycle_length || 28,
          },
        });
      }
    } catch {}

    try {
      const notes = await getBodyNotes();
      this.setData({ bodyNotes: notes });
    } catch {}
  },

  async recordStart() {
    const today = new Date().toISOString().split('T')[0];
    try {
      await recordPeriod(today);
      wx.showToast({ title: '已记录', icon: 'success' });
      this.loadData();
    } catch {
      wx.showToast({ title: '记录失败', icon: 'none' });
    }
  },

  toggleCheck(e: any) {
    const key = e.currentTarget.dataset.key;
    const checks = this.data.bodyChecks.map((c: any) =>
      c.key === key ? { ...c, checked: !c.checked } : c
    );
    this.setData({ bodyChecks: checks });
  },

  async saveBodyCheck() {
    const checked = this.data.bodyChecks.filter((c: any) => c.checked);
    for (const c of checked) {
      try { await addBodyNote(c.key, c.label, 1); } catch {}
    }
    wx.showToast({ title: '已保存', icon: 'success' });
    this.loadData();
  },
});
