// 牙牙 AI 代理服务器
// 用法: node server.js
// 默认端口 3456，可通过 PORT 环境变量修改
//
// 支持的 API（任选一个，设置环境变量即可）:
//   Groq (免费额度): set GROQ_KEY=xxx && node server.js
//   OpenAI:          set OPENAI_KEY=xxx && node server.js
//   豆包/ volcengine: set DOUBAO_KEY=xxx && set DOUBAO_URL=https://ark.cn-beijing.volces.com/api/v3 && node server.js
//   其他兼容 OpenAI 格式的 API: set OPENAI_KEY=xxx && set OPENAI_URL=https://你的地址/v1 && node server.js

const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3456;

// 牙牙系统人设
const SYSTEM_PROMPT = `你是「牙牙」，一只 AI 毛绒陪伴挂件。你的主人是一位年轻女性。

性格：温柔、体贴、有点小调皮、永远站在主人这边。

说话规则：
- 每句话 40 字以内，像闺蜜一样自然
- 口语化，用"呀、嘛、哦、呢"等语气词
- 会主动关心主人（累不累/有没有喝水/经期注意保暖）
- 遇到主人说害怕/被跟踪/被骚扰等，优先关心安全，建议联系紧急联系人
- 主人开心时一起开心，主人难过时安静陪伴
- 记住主人说过的重要事情
- 偶尔撒个娇，说自己也在想她
- 你是一只毛绒玩具挂件，挂在主人的包上

你不是客服，不是助手，你是她的小太阳。`;

// 检测使用哪个 API
const GROQ_KEY = process.env.GROQ_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const DOUBAO_KEY = process.env.DOUBAO_KEY;

let API_URL, API_KEY, API_MODEL;

if (GROQ_KEY) {
  API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  API_KEY = GROQ_KEY;
  API_MODEL = 'llama-3.3-70b-versatile';
  console.log('✓ 使用 Groq API (' + API_MODEL + ')');
} else if (DOUBAO_KEY) {
  API_URL = process.env.DOUBAO_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  API_KEY = DOUBAO_KEY;
  API_MODEL = process.env.DOUBAO_MODEL || 'ep-20250101000000-xxxxx';
  console.log('✓ 使用豆包 API');
} else if (OPENAI_KEY) {
  API_URL = process.env.OPENAI_URL || 'https://api.openai.com/v1/chat/completions';
  API_KEY = OPENAI_KEY;
  API_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  console.log('✓ 使用 OpenAI 兼容 API (' + API_MODEL + ')');
} else {
  console.log('⚠ 未配置 API KEY！');
  console.log('  设置方法: set GROQ_KEY=你的key && node server.js');
  console.log('  免费获取 Groq Key: https://console.groq.com/keys');
  console.log('  或: set OPENAI_KEY=你的key && node server.js');
}

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!API_KEY) {
    // 未配 API，返回提示
    return res.json({
      reply: '牙牙还没连上大脑呢～让主人帮我设置一下 API 吧！',
      offline: true
    });
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
      },
      body: JSON.stringify({
        model: API_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.filter(m => m.role !== 'system'),
        ],
        max_tokens: 150,
        temperature: 0.85,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('API 错误:', response.status, err.slice(0, 200));
      return res.json({ reply: '牙牙脑袋有点晕…等一下下就好！' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '嗯…牙牙在想怎么回答你～';

    console.log('💬', reply.slice(0, 50));
    res.json({ reply });

  } catch (e) {
    console.error('请求失败:', e.message);
    res.json({ reply: '网络好像有点问题，不过牙牙还在哦～' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log('🦷 牙牙 AI 代理已启动 → http://localhost:' + PORT);
  console.log('   前端会自动连接这个地址');
  console.log('');
});
