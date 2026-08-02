// AI 对话页 — SSE 流式 + DeepSeek
const http = require('../../services/http');

Page({
  data: {
    messages: [],
    inputText: '',
    isThinking: false,
    scrollToId: '',
    convId: '',

    quickPrompts: [
      '牙牙，我今天心情好好～',
      '最近好累啊...',
      '和你分享一下今天的事',
      '讲个睡前故事吧',
      '你觉得我是什么样的人？',
    ],
  },

  onLoad(options) {
    if (options.voice) this.setData({ inputText: '（语音消息）' });
    this.loadHistory();
    // 进聊天页自动生成每日话题
    this.loadDailyTopic();
  },

  // 加载对话历史
  async loadHistory() {
    try {
      const convs = await http.get('/chat/history?page=1&pageSize=30');
      if (!convs || convs.length === 0) return;
      // 取最新会话的消息
      // GET /chat/history 返回会话列表，消息需单独加载
    } catch(e) {}
  },

  // 加载每日话题作为建议
  async loadDailyTopic() {
    try {
      const topics = await http.get('/dailytopic/today');
      if (topics && topics.length > 0) {
        const prompts = topics.filter(t => !t.responded).map(t => t.question).slice(0, 5);
        if (prompts.length > 0) this.setData({ quickPrompts: prompts });
      }
    } catch(e) {}
  },

  onInput(e) { this.setData({ inputText: e.detail.value }); },

  // ═══ 发送消息 (SSE 流式) ═══
  async sendText() {
    const text = this.data.inputText.trim();
    if (!text || this.data.isThinking) return;

    const userMsg = { _id: 'u' + Date.now(), role: 'user', content: text, isStreaming: false };
    const msgs = [...this.data.messages, userMsg];
    this.setData({ messages: msgs, inputText: '', isThinking: true });
    this.scrollToBottom();

    // 添加占位消息
    const yayaMsg = { _id: 'y' + Date.now(), role: 'assistant', content: '', emotion: 'neutral', isStreaming: true };
    msgs.push(yayaMsg);
    this.setData({ messages: [...msgs] });
    this.scrollToBottom();

    const aiIdx = this.data.messages.length - 1;

    http.chatStream(
      text, this.data.convId,
      (token) => {
        const m = this.data.messages;
        m[aiIdx].content += token;
        this.setData({ messages: m });
      },
      (convId) => {
        const m = this.data.messages;
        m[aiIdx].isStreaming = false;
        this.setData({ messages: m, convId: convId || this.data.convId, isThinking: false });
        this.scrollToBottom();
      },
      (err) => {
        const m = this.data.messages;
        m[aiIdx].content = '哎呀，牙牙信号不太好...等一下再试试？🥺';
        m[aiIdx].isStreaming = false;
        this.setData({ messages: m, isThinking: false });
      }
    );
  },

  // 快捷提问
  quickChat(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputText: text });
    this.sendText();
  },

  scrollToBottom() {
    const len = this.data.messages.length;
    if (len > 0) this.setData({ scrollToId: 'msg-' + (len - 1) });
  },

  onShareAppMessage() {
    return { title: '和牙牙的聊天', path: '/pages/chat/chat' };
  },
});
