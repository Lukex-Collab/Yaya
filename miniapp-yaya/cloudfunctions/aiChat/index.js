// cloudfunctions/aiChat/index.js — AI 对话云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const { buildSystemPrompt } = require('./prompts');

// DeepSeek API 兼容 OpenAI SDK 格式
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

exports.main = async (event, context) => {
  const { content, history, memories, emotion, nickname, yayaNickname, companionDays } = event;

  // 组装 System Prompt
  const systemPrompt = buildSystemPrompt({
    nickname: nickname || '你',
    yayaNickname: yayaNickname || '牙牙',
    companionDays: companionDays || 1,
    personalityTrait: '温柔',
    emotion: emotion || 'happy',
    memories: memories || [],
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).slice(-20).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content },
  ];

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.8,
        max_tokens: 200,
        stream: false, // 云函数暂用非流式
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '牙牙有点走神了...再说一遍好不好？🥺';

    // 保存消息到数据库
    const db = cloud.database();
    await db.collection('messages').add({
      data: {
        userId: cloud.getWXContext().OPENID,
        role: 'user',
        content,
        emotion: emotion || 'neutral',
        createdAt: new Date(),
      },
    });
    await db.collection('messages').add({
      data: {
        userId: cloud.getWXContext().OPENID,
        role: 'assistant',
        content: reply,
        emotion: emotion || 'neutral',
        createdAt: new Date(),
      },
    });

    return { code: 0, reply };
  } catch (err) {
    console.error('[aiChat] Error:', err);
    return { code: -1, msg: err.message, reply: '哎呀，牙牙信号不太好...再说一遍好不好？🥺' };
  }
};
