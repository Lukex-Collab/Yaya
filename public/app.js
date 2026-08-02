// public/app.js — 灵伴 Web Demo 对接 Go 后端
// 浏览器直接打开 public/index.html + 启动 Go 后端 → 完整体验
// 启动: cd server && go run cmd/server/main.go

const API = 'http://localhost:8080/api/v1';
let token = localStorage.getItem('lingpal_token') || '';
let currentConvId = '';

// ═══ HTTP 客户端 ═══
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (data.code === 0) return data.data;
  throw new Error(data.msg || '请求失败');
}

// ═══ 登录 ═══
async function login(nickname) {
  const result = await api('POST', '/auth/wechat/login', { code: 'dev', nickname });
  token = result.token;
  localStorage.setItem('lingpal_token', token);
  return result;
}

// ═══ SSE 流式对话 ═══
async function* chatStream(content) {
  const res = await fetch(API + '/chat/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({ content, conversation_id: currentConvId }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6));
          if (event.content) yield { type: 'token', text: event.content };
          if (event.conv_id) currentConvId = event.conv_id;
          if (event.done) yield { type: 'done', convId: event.conv_id };
          if (event.error) yield { type: 'error', message: event.error };
        } catch(e) {}
      }
    }
  }
}

// ═══ 便捷 API ═══
const yaya = {
  login: (nick) => login(nick || '牙牙的朋友'),
  chat: chatStream,
  getProfile: () => api('GET', '/user/profile'),
  getYayaStatus: () => api('GET', '/care/yaya-status'),
  getTodayTopics: () => api('GET', '/dailytopic/today'),
  getOnboarding: () => api('GET', '/onboarding/status'),
  getAchievements: () => api('GET', '/achievement/list'),
  getTodayDream: () => api('GET', '/dream/tonight'),
  getWeeklyLetter: () => api('GET', '/yayaletter/this-week'),
  getAttachment: () => api('GET', '/attachment/status'),
  checkIn: () => api('GET', '/attachment/checkin'),
  getWorldPet: () => api('GET', '/world/pet'),
  getSafetyDevices: () => api('GET', '/safety/devices'),
  getVoices: () => api('GET', '/tts/voices'),
  getMoodReport: () => api('GET', '/emotion/report'),
  search: (q) => api('GET', '/search?q=' + encodeURIComponent(q)),
};

// ═══ 导出 ═══
if (typeof window !== 'undefined') {
  window.yaya = yaya;
  window.lingpal = { api, login, chatStream, token: () => token };
}
