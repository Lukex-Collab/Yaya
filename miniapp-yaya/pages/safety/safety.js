import { getSafetyStatus, getSafetyHistory } from '../../services/safety';

Page({
  data: {
    status: { mode: 'simulated', door_ok: true, window_ok: true, motion: 'none', last_check: '' },
    history: [] as any[],
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const status = await getSafetyStatus();
      this.setData({ status });
    } catch {}

    try {
      const history = await getSafetyHistory();
      this.setData({ history });
    } catch {}
  },
});
