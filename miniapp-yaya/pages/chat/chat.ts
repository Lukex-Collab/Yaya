import { sendMessage, getHistory } from '../../services/chat';

interface Message {
  _id: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: string;
  isStreaming?: boolean;
}

Page({
  data: {
    messages: [] as Message[],
    inputText: '',
    isThinking: false,
    convId: '',
    scrollToId: '',
    quickPrompts: [
      '今天有点累...',
      '我今天遇到一件有趣的事！',
      '给我讲个故事吧',
      '你觉得我是什么样的人？',
    ],
  },

  onLoad() {
    this.loadHistory();
  },

  async loadHistory() {
    try {
      const convs = await getHistory();
      if (convs && convs.length > 0) {
        // 暂不加载历史消息，只记录最近的 convId
      }
    } catch {}
  },

  sendQuickPrompt(e: any) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputText: text });
    this.sendText();
  },

  onInput(e: any) {
    this.setData({ inputText: e.detail.value });
  },

  async sendText() {
    const content = this.data.inputText.trim();
    if (!content || this.data.isThinking) return;

    const msgId = `msg-${Date.now()}`;
    const userMsg: Message = { _id: msgId, role: 'user', content };
    const assistantMsg: Message = { _id: `ai-${Date.now()}`, role: 'assistant', content: '', isStreaming: true };

    this.setData({
      messages: [...this.data.messages, userMsg, assistantMsg],
      inputText: '',
      isThinking: true,
      scrollToId: `msg-${this.data.messages.length + 1}`,
    });

    let fullContent = '';
    let lastConvId = this.data.convId;

    sendMessage(
      content,
      this.data.convId,
      (event) => {
        if (event.error) {
          wx.showToast({ title: event.error, icon: 'none' });
          this.setData({ isThinking: false });
          return;
        }

        if (event.conv_id) lastConvId = event.conv_id;

        if (event.content) {
          fullContent += event.content;
          const msgs = this.data.messages;
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = fullContent;
            this.setData({ messages: msgs });
          }
        }

        if (event.done) {
          const msgs = this.data.messages;
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.isStreaming = false;
            lastMsg.content = fullContent;
            this.setData({
              messages: msgs,
              isThinking: false,
              convId: lastConvId,
            });
          }
        }
      },
      (error) => {
        wx.showToast({ title: error.message || '发送失败', icon: 'none' });
        this.setData({ isThinking: false });
      }
    );
  },

  showEmotionPicker() {
    // 简化版：展示情绪标签选择
  },
});
