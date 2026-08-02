// cloudfunctions/memoryIngest/index.js — 记忆提取云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

exports.main = async (event, context) => {
  const { messages, existingMemories = [] } = event;

  const prompt = `分析对话，提取用户的新信息。已有记忆（避免重复）：${existingMemories.map(m => m.content).join('; ') || '无'}

对话：
${messages.map(m => `${m.role==='user'?'用户':'牙牙'}: ${m.content}`).join('\n')}

以JSON数组提取：content(事实描述), type(fact|event|preference|emotion|health), importance(1-10), emotion
只输出JSON数组，无新信息返回[]`;

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '[]';
    const memories = JSON.parse(text.trim().replace(/```json|```/g, ''));

    if (Array.isArray(memories) && memories.length > 0) {
      for (const m of memories) {
        await db.collection('memories').add({
          data: {
            userId: cloud.getWXContext().OPENID,
            content: m.content,
            type: m.type || 'fact',
            importance: m.importance || 5,
            emotion: m.emotion || 'neutral',
            decayFactor: 1.0,
            accessCount: 0,
            lastAccessed: new Date(),
            isLocked: false,
            createdAt: new Date(),
          },
        });
      }
      return { code: 0, extracted: memories.length };
    }
    return { code: 0, extracted: 0 };
  } catch (err) {
    console.error('[memoryIngest] Error:', err);
    return { code: -1, msg: err.message };
  }
};
