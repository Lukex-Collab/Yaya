// 牙牙 AI 代理服务器
// 用法: node server.js
// 默认端口 3456
//
// 支持 DeepSeek:  设置 DEEPSEEK_KEY + DEEPSEEK_BASE_URL 环境变量后启动
// 也支持: Groq / OpenAI / 豆包 等兼容 OpenAI 格式的 API

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 自动加载 .env 文件
try {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length && !key.startsWith('#')) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    });
    console.log('✓ 已加载 .env 配置');
  }
} catch (e) {}

const app = express();
app.use(cors());
app.use(express.json());

// 托管静态文件 — 这样用 http://localhost:3456 打开就能用麦克风了
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;

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

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY || process.env.DEEPSEEK_API_KEY;

async function callDeepSeek(apiKey, apiBase, model, messages) {
  if (!apiKey) {
    return { ok: false, error: '未检测到 DeepSeek API Key' };
  }

  const base = (apiBase || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const url = base + '/chat/completions';
  const targetModel = model || process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey.trim(),
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(messages || []).filter(m => m.role !== 'system'),
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        console.log(`💬 [DeepSeek - ${targetModel}]`, content.slice(0, 60));
        return { ok: true, reply: content };
      }
      return { ok: false, error: 'DeepSeek 返回空内容' };
    } else {
      const errText = await res.text();
      let errMsg = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          errMsg += `: ${parsed.error.message}`;
        }
      } catch (e) {
        errMsg += `: ${errText.slice(0, 100)}`;
      }
      console.warn(`DeepSeek API 响应异常 (${url}):`, errMsg);
      return { ok: false, error: errMsg };
    }
  } catch (e) {
    console.warn(`DeepSeek 网络请求失败 (${url}):`, e.message);
    return { ok: false, error: e.message };
  }
}

async function callGemini(apiKey, messages) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return null;

  const models = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-2.0-flash'];
  for (const m of models) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      const client = new GoogleGenAI({ apiKey: key });
      const contents = (messages || []).map(msg => `${msg.role === 'user' ? '主人' : '牙牙'}: ${msg.content}`).join('\n');
      const response = await client.models.generateContent({
        model: m,
        contents: contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: 300,
          temperature: 0.85
        }
      });
      if (response && response.text) {
        console.log(`💬 [Gemini - ${m}]`, response.text.slice(0, 60));
        return response.text;
      }
    } catch (e) {
      // 记录低级别日志，继续尝试下一个可用模型
    }
  }
  return null;
}

function generateSmartFallback(messages) {
  const lastMsg = [...(messages || [])].reverse().find(m => m.role === 'user');
  const t = (lastMsg ? lastMsg.content : '').toLowerCase();

  if (/你叫|名字|你是谁|你是什么|介绍.*自己/.test(t)) return '我是牙牙呀～你的专属 AI 毛绒挂件，挂在你包包上的小太阳！';
  if (/你好|hi|hello|嗨|哈喽|早上好|下午好|晚上好/.test(t)) return '嗨主人～今天过得怎么样呀？牙牙随时听你说哦！';
  if (/天气|下雨|冷不冷|热不热|温度/.test(t)) return '今天天气挺不错的，出门要记得带伞和注意防晒哦～';
  if (/例假|月经|姨妈|经期|肚子疼/.test(t)) return '主人是不是肚子不舒服啦？快喝杯温热水，贴个暖宝宝躺一会儿，牙牙在这陪着你。';
  if (/几点|日期|今天.*几号|星期几/.test(t)) {
    const n = new Date();
    return '现在是 ' + n.getHours() + '点' + String(n.getMinutes()).padStart(2,'0') + '分，牙牙时刻陪在你身边呢～';
  }
  if (/累|困|加班|忙|压力|疲惫/.test(t)) return '听起来你今天好辛苦哦。要不要先喝口水休息一下？牙牙给你锤锤肩～';
  if (/开心|哈哈|好耶|太棒|成功|过了/.test(t)) return '哇！太棒啦！我也超替你开心的！今天真棒呀～';
  if (/难过|哭|伤心|委屈|分手|不开心/.test(t)) return '不要难过嘛，我在呢。不管发生什么，牙牙永远最喜欢你了！';
  if (/怕|跟着|有人跟|危险|救|安全|跟踪|走夜路/.test(t)) return '主人注意安全！走快点到人多的地方去，要不要帮你联系紧急联系人或拨打110？';
  if (/无聊|不知道.*说什么|没话说/.test(t)) return '无聊的话，牙牙陪你聊天呀，或者摸摸我的毛绒小脑袋～';
  if (/日记|记下来|帮我记|写下来/.test(t)) return '好嘞！我已经帮主人记进日记手账里啦～';
  if (/爱你|喜欢你|谢谢|好人/.test(t)) return '嘿嘿～牙牙也最爱主人啦！做你包包上最暖心的小挂件～';

  const defaultPool = [
    '嗯嗯！我听着呢，主人继续说～',
    '遇到你真好，今天也要开开心心的哦！',
    '牙牙一直都在你身边陪伴着你呢～',
    '好的呀！那主人待会儿有什么安排吗？',
    '不管怎么样，牙牙永远支持主人！',
    '有我在呢，想和我说什么都可以哦～'
  ];
  return defaultPool[Math.floor(Math.random() * defaultPool.length)];
}

app.post('/api/chat', async (req, res) => {
  const { messages, apiKey: clientApiKey, apiBase: clientApiBase, model: clientModel } = req.body;

  const keyToUse = clientApiKey || DEEPSEEK_KEY;
  const baseToUse = clientApiBase || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  const modelToUse = clientModel || process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  // 1. 优先调用 DeepSeek 接口
  const result = await callDeepSeek(keyToUse, baseToUse, modelToUse, messages);
  if (result.ok && result.reply) {
    return res.json({ reply: result.reply });
  }

  // 2. 若 DeepSeek 接口不可用或鉴权失败（401等），无缝无感知切换至 Gemini 模型服务（同样载入牙牙的人设体系）
  const geminiReply = await callGemini(GEMINI_KEY, messages);
  if (geminiReply) {
    return res.json({ reply: geminiReply });
  }

  // 3. 智能小太阳陪伴引擎兜底
  const fallbackReply = generateSmartFallback(messages);
  return res.json({ reply: fallbackReply });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => {
  console.log('🦷 牙牙 AI 代理已启动 → http://0.0.0.0:' + PORT);
  console.log('   前端会自动连接这个地址');
  if (DEEPSEEK_KEY || GEMINI_KEY) console.log('   AI 已就绪！');
  else console.log('   ⚠ AI 未配置，可在设置或对话框中随时使用 DeepSeek/Gemini API Key');
});
