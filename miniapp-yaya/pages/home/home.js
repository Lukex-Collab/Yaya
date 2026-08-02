// 牙牙主页 — 接入 Go 后端 API
const http = require('../../services/http');
const app = getApp();

Page({
  data: {
    statusBarHeight: 20,
    greetingText: '牙牙在呢',
    userNickname: '你',
    companionDays: 1,
    intimacyScore: 75,
    todayDate: '',
    womenFact: '加载中...',
    careMessage: '今天喝水了吗？',
    hintText: '点击牙牙可以和她玩哦～',

    // 牙牙状态
    yayaState: { mood: 'happy', currentEmoji: '🧸', message: '' },
    isRecording: false,
    safetyStatus: 'safe',
    currentLevel: { name: '初识' },

    // 引导
    showOnboarding: false,
    onboardingStep: null,
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    this.initPage();
  },

  onShow() {
    this.updateGreeting();
    this.loadYayaStatus();
    this.loadOnboarding();
  },

  async initPage() {
    const now = new Date();
    const weekDays = ['日','一','二','三','四','五','六'];
    this.setData({ todayDate: now.getMonth()+1 + '月' + now.getDate() + '日 星期' + weekDays[now.getDay()] });

    try {
      // 加载用户信息
      const user = await http.get('/user/profile');
      this.setData({
        userNickname: user.nickname || '你',
        companionDays: user.companion_days || 1,
      });
    } catch(e) {}

    // 加载女子日历
    try {
      const event = await http.get('/ritual/calendar/today');
      this.setData({ womenFact: event.summary || '每一天都有女性在创造历史 ✨' });
    } catch(e) {
      this.setData({ womenFact: '历史上的今天，女性在发光 ✨' });
    }

    this.updateGreeting();
    this.loadYayaStatus();
    this.loadOnboarding();
  },

  updateGreeting() {
    const h = new Date().getHours();
    let g = '牙牙在呢';
    if (h >= 6 && h < 9) g = '早安呀～☀️';
    else if (h >= 9 && h < 12) g = '上午好～';
    else if (h >= 12 && h < 14) g = '午安～';
    else if (h >= 14 && h < 18) g = '下午好～';
    else if (h >= 18 && h < 22) g = '晚上好～';
    else if (h >= 22 || h < 6) g = '夜深了～';

    const cares = ['记得吃早餐呀🥛','今天喝水了吗？💧','起来活动一下～','今天过得怎么样？💭','牙牙帮你守着🌙'];
    const idx = h >= 6 && h < 12 ? 0 : h >= 12 && h < 18 ? 1 : h >= 18 && h < 22 ? 3 : 4;
    this.setData({ greetingText: g, careMessage: cares[idx] || cares[2] });
  },

  // 加载牙牙实时状态
  async loadYayaStatus() {
    try {
      const status = await http.get('/care/yaya-status');
      let emoji = '🧸';
      if (status.mood === '超开心') emoji = '🥰';
      else if (status.mood === '需要你') emoji = '🥺';
      this.setData({
        'yayaState.mood': status.mood === '超开心' ? 'happy' : status.mood === '需要你' ? 'worried' : 'happy',
        'yayaState.currentEmoji': emoji,
        'yayaState.message': status.care_prompt || '',
      });
    } catch(e) {}
  },

  // 加载引导状态
  async loadOnboarding() {
    try {
      const ob = await http.get('/onboarding/status');
      if (ob.next_step && ob.progress_pct < 100) {
        this.setData({ showOnboarding: true, onboardingStep: ob.next_step });
      }
    } catch(e) {}
  },

  // ═══ 牙牙互动 ═══
  onYayaTap() {
    const reactions = [
      { emoji: '😊', msg: '嘻嘻，你戳我干嘛～' },
      { emoji: '🥰', msg: '你回来啦，牙牙好想你！' },
      { emoji: '😜', msg: '再戳我就要撒娇了哦～' },
      { emoji: '🤗', msg: '抱抱！' },
    ];
    const r = reactions[Math.floor(Math.random() * reactions.length)];
    this.setData({ 'yayaState.currentEmoji': r.emoji, 'yayaState.mood': 'happy', 'yayaState.message': r.msg });
    // 通知硬件触摸
    http.post('/hardware/touch', {}).catch(() => {});
    clearTimeout(this._reactionTimer);
    this._reactionTimer = setTimeout(() => this.loadYayaStatus(), 3000);
  },

  onYayaLongPress() {
    this.setData({ 'yayaState.currentEmoji': '🥰', 'yayaState.mood': 'coquettish', 'yayaState.message': '嗯嗯...好舒服呀～', hintText: '多摸摸牙牙吧' });
    http.post('/hardware/hold', {}).catch(() => {});
    wx.vibrateShort({ type: 'light' });
    clearTimeout(this._cuddleTimer);
    this._cuddleTimer = setTimeout(() => { this.loadYayaStatus(); this.setData({ hintText: '点击牙牙可以和她玩哦～' }); }, 5000);
  },

  // ═══ 语音 → 聊天 ═══
  startRecord() {
    this.setData({ isRecording: true, hintText: '牙牙在听...' });
    clearTimeout(this._recordTimer);
    this._recordTimer = setTimeout(() => this.stopRecord(), 5000);
  },

  stopRecord() {
    this.setData({ isRecording: false, hintText: '牙牙听到了！' });
    wx.navigateTo({ url: '/pages/chat/chat' });
  },

  // ═══ 页面跳转 ═══
  openChat() { wx.navigateTo({ url: '/pages/chat/chat' }); },
  goSafety() { wx.navigateTo({ url: '/pages/safety/safety' }); },
  goOnboarding() {
    const step = this.data.onboardingStep;
    if (step && step.action_path) {
      if (step.action_path.startsWith('/pages/')) wx.navigateTo({ url: step.action_path });
      else wx.showToast({ title: step.title, icon: 'none' });
    }
  },

  onPullDownRefresh() { this.initPage(); wx.stopPullDownRefresh(); },
  onShareAppMessage() {
    return { title: '牙牙在，就不孤单 🧸', path: '/pages/home/home', imageUrl: '/images/share-yaya.png' };
  },
});
