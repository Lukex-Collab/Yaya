// 牙牙 AI 代理服务器
// 用法: node server.js
// 默认端口 3456
//
// 支持 DeepSeek:  设置 DEEPSEEK_KEY + DEEPSEEK_BASE_URL 环境变量后启动
// 也支持: Groq / OpenAI / 豆包 等兼容 OpenAI 格式的 API

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

// 检测 API
const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;
const DEEPSEEK_URL = process.env.DEEPSEEK_BASE_URL;
const GROQ_KEY = process.env.GROQ_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const DOUBAO_KEY = process.env.DOUBAO_KEY;

let API_URL, API_KEY, API_MODEL;

if (DEEPSEEK_KEY && DEEPSEEK_URL) {
  API_URL = DEEPSEEK_URL.replace(/\/+$/, '') + '/chat/completions';
  API_KEY = DEEPSEEK_KEY;
  API_MODEL = 'deepseek-chat';
  console.log('✓ 使用 DeepSeek API (' + API_MODEL + ')');
  console.log('  ' + API_URL);
} else if (GROQ_KEY) {
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
  console.log('  DeepSeek: set DEEPSEEK_KEY=xxx && set DEEPSEEK_BASE_URL=https://api.deepseek.com/v1 && node server.js');
  console.log('  Groq:     set GROQ_KEY=xxx && node server.js');
  console.log('  OpenAI:   set OPENAI_KEY=xxx && node server.js');
  console.log('  豆包:    set DOUBAO_KEY=xxx && node server.js');
}

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!API_KEY) {
    return res.json({
      reply: '牙牙还没连上大脑呢～让主人帮我设置一下 API 吧！你可以用 DeepSeek 的 key 哦。',
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
        max_tokens: 200,
        temperature: 0.85,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('API 错误:', response.status, err.slice(0, 300));
      return res.json({ reply: '牙牙脑袋有点晕…等一下下就好！' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '嗯…牙牙在想怎么回答你～';

    console.log('💬', reply.slice(0, 60));
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
  if (API_KEY) console.log('   AI 已就绪！');
  else console.log('   ⚠ AI 未配置，将使用离线 mock 回复');
});
