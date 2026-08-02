// pages/chat/chat.js — AI 对话页逻辑
const { sendMessage, analyzeEmotion } = require('../../services/chat');
const { searchMemories, extractAndStore } = require('../../services/memory');
const { generateJournal } = require('../../services/journal');
const { EMOTION_EMOJI } = require('../../utils/constants');
const app = getApp();

Page({
  data: {
    messages: [],
    inputText: '',
    isThinking: false,
    scrollToId: '',
    currentEmotion: 'neutral',
    sessionsToday: 0,

    // 快捷提问
    quickPrompts: [
      '牙牙，我今天心情好好～',
      '最近好累啊...',
      '和你分享一下今天发生的事',
      '你觉得我是什么样的人？',
      '讲个睡前故事吧',
    ],
  },

  onLoad(options) {
    // 如果从语音入口进来
    if (options.voice) {
      this.setData({ inputText: '（语音消息）' });
      this.sendText();
    }
    this.loadHistory();
  },

  /** 加载最近对话历史 */
  async loadHistory() {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('messages')
        .where({ userId: app.globalData.userInfo?._id || '' })
        .orderBy('createdAt', 'desc')
        .limit(30)
        .get();

      if (res.data.length > 0) {
        this.setData({
          messages: res.data.reverse().map(m => ({
            ...m,
            _id: m._id,
            role: m.role,
            content: m.content,
            emotion: m.emotion,
            isStreaming: false,
          })),
        });
        setTimeout(() => this.scrollToBottom(), 300);
      }
    } catch (err) {
      console.error('[chat] 加载历史失败:', err);
    }
  },

  /** 输入处理 */
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  /** 发送文字消息 */
  async sendText() {
    const text = this.data.inputText.trim();
    if (!text || this.data.isThinking) return;

    // 添加用户消息
    const userMsg = {
      _id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      emotion: '',
      createdAt: new Date(),
    };

    const messages = [...this.data.messages, userMsg];
    this.setData({
      messages,
      inputText: '',
      isThinking: true,
    });
    this.scrollToBottom();

    try {
      // 1. 情绪分析
      const emotion = await analyzeEmotion(text);
      this.setData({ currentEmotion: emotion });

      // 2. 检索相关记忆
      const { memories: relevantMemories } = await searchMemories(
        app.globalData.userInfo?._id || 'demo',
        text,
        5
      );

      // 3. 发送消息获取回复
      const yayaMsg = {
        _id: `yaya_${Date.now()}`,
        role: 'assistant',
        content: '',
        emotion: emotion,
        isStreaming: true,
        createdAt: new Date(),
      };

      this.setData({
        messages: [...this.data.messages, yayaMsg],
        isThinking: false,
      });
      this.scrollToBottom();

      const lastIndex = this.data.messages.length - 1;

      await sendMessage({
        content: text,
        history: this.data.messages
          .filter(m => !m.isStreaming)
          .slice(-20)
          .map(m => ({ role: m.role, content: m.content })),
        memories: relevantMemories || [],
        emotion,
        user: {
          nickname: app.globalData.userInfo?.nickname || '你',
          companionDays: app.globalData.companionDays || 1,
          yayaNickname: '牙牙',
        },
        onToken: (token) => {
          // 流式更新（实际由云函数处理后返回完整文本）
          const msgs = this.data.messages;
          msgs[lastIndex].content += token;
          this.setData({ messages: msgs });
        },
        onComplete: async (fullText) => {
          const msgs = this.data.messages;
          msgs[lastIndex].content = fullText;
          msgs[lastIndex].isStreaming = false;
          this.setData({ messages: msgs });

          // 4. 异步：提取记忆
          const recentMsgs = [
            { role: 'user', content: text },
            { role: 'assistant', content: fullText },
          ];
          extractAndStore(
            app.globalData.userInfo?._id || 'demo',
            recentMsgs
          ).catch(() => {});

          // 5. 异步：检查是否需要生成日记（每天首次对话）
          if (this.data.sessionsToday === 0) {
            generateJournal(
              app.globalData.userInfo?._id || 'demo',
              recentMsgs
            ).catch(() => {});
            this.setData({ sessionsToday: 1 });
          }

          // 6. 更新成长数据
          app.globalData.companionDays = (app.globalData.companionDays || 1) + 0;

          this.scrollToBottom();
        },
        onError: (err) => {
          const msgs = this.data.messages;
          msgs[lastIndex].content = '哎呀，牙牙信号不太好...再说一遍好不好？ 🥺';
          msgs[lastIndex].isStreaming = false;
          msgs[lastIndex].emotion = 'sad';
          this.setData({ messages: msgs });
        },
      });
    } catch (err) {
      console.error('[chat] 发送失败:', err);
      this.setData({ isThinking: false });
      wx.showToast({ title: '网络开小差了', icon: 'none' });
    }
  },

  /** 发送快捷提示 */
  sendQuickPrompt(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputText: text });
    this.sendText();
  },

  /** 滚动到底部 */
  scrollToBottom() {
    const len = this.data.messages.length;
    if (len > 0) {
      this.setData({ scrollToId: `msg-${len - 1}` });
    }
  },

  /** 情绪选择 */
  showEmotionPicker() {
    const emotions = [
      { label: '😊 开心', value: 'happy' },
      { label: '😢 难过', value: 'sad' },
      { label: '😰 焦虑', value: 'anxious' },
      { label: '😤 生气', value: 'angry' },
      { label: '😌 平静', value: 'calm' },
    ];
    wx.showActionSheet({
      itemList: emotions.map(e => e.label),
      success: (res) => {
        const emotion = emotions[res.tapIndex];
        this.setData({ currentEmotion: emotion.value });
        wx.showToast({ title: '牙牙知道你的心情了', icon: 'none' });
      },
    });
  },

  /** 分享对话 */
  onShareAppMessage() {
    const lastMsgs = this.data.messages.slice(-3);
    const preview = lastMsgs.map(m =>
      `${m.role === 'user' ? '我' : '牙牙'}: ${m.content.slice(0, 30)}`
    ).join('\n');

    return {
      title: preview || '和牙牙的聊天',
      path: '/pages/chat/chat',
    };
  },
});
