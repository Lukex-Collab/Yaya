// pages/home/home.js — 牙牙主页逻辑
const app = getApp();
const { EMOTION_EMOJI, YAYA_STATES, MILESTONES } = require('../../utils/constants');
const { analyzeEmotion } = require('../../services/chat');
const { searchMemories } = require('../../services/memory');

Page({
  data: {
    statusBarHeight: 20,
    greetingText: '牙牙在呢',
    userNickname: '你',
    todayDate: '',
    womenFact: '加载中...',
    careMessage: '今天喝水了吗？',
    hintText: '点击牙牙可以和她玩哦～',

    // 牙牙状态
    yayaState: {
      mood: 'happy',
      currentEmoji: '😊',
      message: '',
    },

    // 语音
    isRecording: false,

    // 安全
    safetyStatus: 'safe',
    useCanvas: false,

    // 关系成长
    companionDays: 1,
    currentLevel: { name: '初识' },
  },

  onLoad() {
    const app = getApp();
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 20,
    });
    this.initPage();
  },

  onShow() {
    // 每次切回首页更新状态
    this.updateYayaState();
    this.updateCareMessage();
  },

  /** 初始化页面 */
  async initPage() {
    // 设置日期
    const now = new Date();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    this.setData({
      todayDate: `${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`,
    });

    // 获取女子日历
    this.fetchWomenFact();

    // 更新关系等级
    this.updateRelationshipLevel();

    // 更新牙牙状态
    this.updateYayaState();

    // 更新关心语
    this.updateCareMessage();
  },

  /** 更新时间相关问候 */
  updateGreeting() {
    const hour = new Date().getHours();
    let greetingText = '牙牙在呢';
    if (hour >= 6 && hour < 9) greetingText = '早安呀～';
    else if (hour >= 9 && hour < 12) greetingText = '上午好～';
    else if (hour >= 12 && hour < 14) greetingText = '午安～';
    else if (hour >= 14 && hour < 18) greetingText = '下午好～';
    else if (hour >= 18 && hour < 22) greetingText = '晚上好～';
    else if (hour >= 22 || hour < 6) greetingText = '夜深了～';
    this.setData({ greetingText });
  },

  /** 获取女子日历事件 */
  async fetchWomenFact() {
    try {
      // 从云数据库获取今日女性历史事件
      const db = wx.cloud.database();
      const today = new Date();
      const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const res = await db.collection('women_calendar')
        .where({ date_mmdd: mmdd })
        .limit(1)
        .get();

      if (res.data.length > 0) {
        this.setData({ womenFact: res.data[0].summary });
      } else {
        // 兜底
        const fallbacks = [
          '每一天都有女性在创造历史 ✨',
          '你的每一天也值得被记住 💪',
          '历史上的今天，无数女性在闪光 🌟',
        ];
        this.setData({ womenFact: fallbacks[Math.floor(Math.random() * fallbacks.length)] });
      }
    } catch (err) {
      console.error('[women-fact] 获取失败:', err);
      this.setData({ womenFact: '历史上的今天，女性在发光 ✨' });
    }
  },

  /** 更新牙牙状态（根据时间/情绪） */
  updateYayaState() {
    const hour = new Date().getHours();
    let mood = 'happy';
    let emoji = '😊';
    let message = '';

    if (hour >= 22 || hour < 7) {
      mood = 'sleepy';
      emoji = '😴';
      message = '牙牙有点困了...';
    }

    this.setData({
      'yayaState.mood': mood,
      'yayaState.currentEmoji': emoji,
      'yayaState.message': message,
    });
    this.updateGreeting();
  },

  /** 更新关心消息 */
  updateCareMessage() {
    const hour = new Date().getHours();
    const messages = {
      morning: ['今天天气不错，记得涂防晒 ☀️', '早安！喝杯温水开启新一天 🥛', '记得吃早餐呀～'],
      afternoon: ['今天喝水了吗？💧', '下午了，起来活动一下～', '别太累哦，休息一下'],
      evening: ['今天过得怎么样？💭', '该吃晚饭啦～🍜', '辛苦了，今天你很棒'],
      night: ['该准备睡觉啦 🌙', '牙牙帮你检查过门窗了，安心睡吧', '晚安好梦～💤'],
    };

    let key = 'afternoon';
    if (hour >= 6 && hour < 12) key = 'morning';
    else if (hour >= 18 && hour < 22) key = 'evening';
    else if (hour >= 22 || hour < 6) key = 'night';

    const list = messages[key];
    this.setData({ careMessage: list[Math.floor(Math.random() * list.length)] });
  },

  /** 更新关系等级 */
  updateRelationshipLevel() {
    const days = app.globalData.companionDays || 1;
    const { getRelationshipLevel } = require('../../utils/prompts');
    const level = getRelationshipLevel(days);
    this.setData({
      companionDays: days,
      currentLevel: level,
    });
  },

  // ═══ 牙牙互动 ═══

  /** 点击牙牙 */
  onYayaTap() {
    const reactions = [
      { emoji: '😊', msg: '嘻嘻，你戳我干嘛～' },
      { emoji: '😳', msg: '哎呀，被发现了！' },
      { emoji: '🥰', msg: '你回来啦，牙牙好想你！' },
      { emoji: '😜', msg: '再戳我就要撒娇了哦～' },
      { emoji: '🤗', msg: '抱抱！' },
    ];
    const reaction = reactions[Math.floor(Math.random() * reactions.length)];

    this.setData({
      'yayaState.currentEmoji': reaction.emoji,
      'yayaState.mood': 'happy',
      'yayaState.message': reaction.msg,
    });

    // 3 秒后恢复
    clearTimeout(this._reactionTimer);
    this._reactionTimer = setTimeout(() => this.updateYayaState(), 3000);
  },

  /** 长按牙牙 — 进入摸摸模式 */
  onYayaLongPress() {
    this.setData({
      'yayaState.currentEmoji': '🥰',
      'yayaState.mood': 'coquettish',
      'yayaState.message': '嗯嗯...好舒服呀～',
      hintText: '多摸摸牙牙吧，她最喜欢了',
    });

    wx.vibrateShort({ type: 'light' });

    clearTimeout(this._cuddleTimer);
    this._cuddleTimer = setTimeout(() => {
      this.updateYayaState();
      this.setData({ hintText: '点击牙牙可以和她玩哦～' });
    }, 5000);
  },

  onYayaTouch(e) {
    // 触摸移动时牙牙跟随方向
    if (e.touches && e.touches.length > 0) {
      // Demo: 牙牙跟随手指微移动（通过 CSS transform 实现）
    }
  },

  // ═══ 语音 ═══

  startRecord() {
    this.setData({ isRecording: true, hintText: '牙牙在听...' });
    wx.vibrateShort({ type: 'light' });

    // 实际录音需使用 wx.getRecorderManager 或微信同声传译插件
    // Demo: 3 秒后自动停止
    clearTimeout(this._recordTimer);
    this._recordTimer = setTimeout(() => this.stopRecord(), 3000);
  },

  stopRecord() {
    this.setData({ isRecording: false, hintText: '牙牙听到了！' });
    // 录音结束 → 进入对话页
    setTimeout(() => {
      wx.navigateTo({ url: '/pages/chat/chat?voice=true' });
    }, 500);
  },

  // ═══ 页面跳转 ═══

  openChat() {
    wx.navigateTo({ url: '/pages/chat/chat' });
  },

  goSafety() {
    wx.navigateTo({ url: '/pages/safety/safety' });
  },

  openBlackboard() {
    // 展开女子日历全屏
    wx.showToast({ title: '女子日历', icon: 'none' });
  },

  openCareDetail() {
    wx.showToast({ title: '关心详情', icon: 'none' });
  },

  /** 下拉刷新 */
  onPullDownRefresh() {
    this.initPage();
    wx.stopPullDownRefresh();
  },

  /** 分享 */
  onShareAppMessage() {
    return {
      title: '牙牙在，就不孤单 🧸',
      path: '/pages/home/home',
      imageUrl: '/images/share-yaya.png',
    };
  },
});
