// services/chat.js — AI 对话服务（CloudBase AI + DeepSeek）
const { buildSystemPrompt, buildEmotionDetectPrompt } = require('../utils/prompts');
const { AI_MODEL, CLOUD_FUNCTIONS } = require('../utils/constants');

/**
 * 发送消息给牙牙（SSE 流式返回）
 *
 * 架构采用 CloudBase AI 内置的 DeepSeek 代理：
 * 小程序端 → 云函数 aiChat → DeepSeek API → 流式返回
 *
 * @param {Object} options
 * @param {string} options.content - 用户消息内容
 * @param {Array} options.history - 最近对话历史 [{role, content}]
 * @param {Array} options.memories - 检索到的记忆 [{type, content}]
 * @param {string} options.emotion - 当前情绪标签
 * @param {Object} options.user - 用户信息 {nickname, companionDays, yayaNickname}
 * @param {Function} options.onToken - token 回调 (token: string)
 * @param {Function} options.onComplete - 完成回调 (fullText: string)
 * @param {Function} options.onError - 错误回调 (error: Error)
 */
async function sendMessage(options) {
  const {
    content,
    history = [],
    memories = [],
    emotion = 'happy',
    user = {},
    onToken,
    onComplete,
    onError,
  } = options;

  try {
    // 方法1: 使用云函数（推荐，可以在服务端做更多控制）
    const res = await wx.cloud.callFunction({
      name: CLOUD_FUNCTIONS.AI_CHAT,
      data: {
        action: 'chat',
        content,
        history: history.slice(-20),      // 最近 20 轮上下文
        memories: memories.slice(0, 5),    // Top-5 相关记忆
        emotion,
        nickname: user.nickname || '你',
        yayaNickname: user.yayaNickname || '牙牙',
        companionDays: user.companionDays || 1,
      },
      config: {
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
      },
    });

    // 云函数已处理流式输出，结果通过回调返回
    if (onComplete && res.result) {
      onComplete(res.result.reply);
    }
  } catch (err) {
    console.error('[chat] 发送失败:', err);
    if (onError) onError(err);
  }
}

/**
 * 在不使用云函数时，直接用 wx.cloud.extend.AI 调用（简化版）
 * 适用于快速测试场景
 */
async function sendMessageDirect(options) {
  const {
    content,
    history = [],
    memories = [],
    emotion = 'happy',
    user = {},
    onToken,
    onComplete,
    onError,
  } = options;

  try {
    const ai = wx.cloud.extend.AI;

    // 组装 System Prompt
    const systemPrompt = buildSystemPrompt({
      nickname: user.nickname || '你',
      yayaNickname: user.yayaNickname || '牙牙',
      companionDays: user.companionDays || 1,
      personalityTrait: user.personalityTrait || '温柔',
      emotion,
      memories,
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-20),
      { role: 'user', content },
    ];

    // 流式调用
    const stream = await ai.chatCompletions({
      model: AI_MODEL,
      messages,
      stream: true,
      temperature: 0.8,
      max_tokens: 200,
    });

    let fullText = '';
    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content || '';
      if (token) {
        fullText += token;
        if (onToken) onToken(token);
      }
    }

    if (onComplete) onComplete(fullText);
  } catch (err) {
    console.error('[chat:direct] 发送失败:', err);
    if (onError) onError(err);
  }
}

/**
 * 分析情绪（使用 AI）
 */
async function analyzeEmotion(message) {
  try {
    const prompt = buildEmotionDetectPrompt(message);

    const ai = wx.cloud.extend.AI;
    const res = await ai.chatCompletions({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: '你是一个情绪分析器。只回复一个英文情绪标签。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 10,
    });

    const emotion = res.choices?.[0]?.message?.content?.trim()?.toLowerCase();
    const validEmotions = ['happy', 'sad', 'anxious', 'angry', 'calm', 'excited', 'tired', 'neutral'];
    return validEmotions.includes(emotion) ? emotion : 'neutral';
  } catch (err) {
    console.error('[emotion] 分析失败:', err);
    return 'neutral';
  }
}

module.exports = {
  sendMessage,
  sendMessageDirect,
  analyzeEmotion,
};
