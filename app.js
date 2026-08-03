/* ══════════════════════════════════════════════════════════
   YAYA 灵伴 v4.0 — Application Logic & Full Interactive Engine
   ══════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const $$ = (s, c) => (c || document).querySelectorAll(s);

const App = {

  // ── API 配置 ────────────────────────────────────────────
  api: { url: '/api/chat', key: '' },

  // ── 牙牙系统人设 ────────────────────────────────────
  yayaPrompt: `你是「牙牙」，一只 AI 毛绒陪伴挂件与灵伴宠物。你的主人是一位叫昭昭的女孩。性格：温柔、体贴、有点小调皮、永远站在主人这边的小太阳。说话规则：每句话40字以内，像闺蜜一样自然。会主动关心主人。主人开心时一起开心，难过时安静陪伴。你不是客服，你是她的小太阳。`,

  // ── 应用状态 State ──────────────────────────────────────
  state: {
    tab: 'yaya',
    coins: 560,
    gems: 25,
    stars: 1280,
    intimacy: 2680,
    level: 4,
    companionDays: 23,
    activityVal: 80,
    isRecording: false,
    chatHistory: [
      { who: 'yy', text: '早上好呀，昭昭！今天有什么想和我分享的吗？~' },
      { who: 'me', text: '我感觉有一点累' },
      { who: 'yy', text: '那就放慢脚步休息一下吧~ 要听一首温柔的歌，还是聊天放松一下呢？' },
      { who: 'me', text: '给我唱首歌吧' },
      { who: 'yy', text: '好嘞！正为你播放轻柔纾压歌单曲目《云朵上的梦》🎵', musicCard: true }
    ],
    tasks: [
      { id: 1, title: '陪牙牙聊天1次', exp: 30, coin: 10, done: true },
      { id: 2, title: '抚摸亲抚牙牙1次', exp: 30, coin: 10, done: true },
      { id: 3, title: '记录今日心情手账', exp: 10, coin: 5, done: false },
      { id: 4, title: '给牙牙喂食1次', exp: 10, coin: 5, done: false }
    ],
    shopItems: [
      { id: 's1', cat: 'apparel', name: '星星项链', price: 280, icon: '⭐', owned: false, equipped: false },
      { id: 's2', cat: 'apparel', name: '云朵帽子', price: 160, icon: '☁️', owned: true, equipped: true },
      { id: 's3', cat: 'apparel', name: '翠蝶翅膀', price: 150, icon: '🦋', owned: false, equipped: false },
      { id: 's4', cat: 'apparel', name: '月亮背包', price: 200, icon: '🌙', owned: false, equipped: false },
      { id: 's5', cat: 'apparel', name: '彩虹翅膀', price: 320, icon: '🌈', owned: false, equipped: false },
      { id: 's6', cat: 'apparel', name: '甜蜜甜甜圈', price: 160, icon: '🍩', owned: false, equipped: false }
    ],
    friends: [
      { id: 'f1', name: '小酸软糖', status: '在线 · 一起探索了朵朵岛', avatar: '👧', visited: false },
      { id: 'f2', name: '奶油泡芙', status: '5分钟前 · 送了你一颗真心', avatar: '🧁', visited: true },
      { id: 'f3', name: '星星糖', status: '30分钟前 · 一起钓了鱼', avatar: '⭐', visited: false },
      { id: 'f4', name: '布丁罐', status: '1小时前 · 夸赞了你的小屋', avatar: '🍮', visited: true }
    ],
    diaryEntries: [
      { date: '8月1日 · 星期五', mood: '😄', weather: '☀️ 31°C', text: '今天和牙牙聊天之后感觉放松了很多！AI 总结说我完成了一件值得骄傲的小事，棒棒哒~' },
      { date: '7月31日 · 星期四', mood: '😊', weather: '⛅ 29°C', text: '有点疲惫，晚上吃了一顿好吃的晚餐，然后抱了抱牙牙玩偶。' },
      { date: '7月30日 · 星期三', mood: '😄', weather: '☀️ 33°C', text: '收到小小的礼物，超级开心！和朋友逛了街。' }
    ]
  },

  // ── 初始化 ────────────────────────────────────────────
  init() {
    this.bindIntro();
    this.bindNavigation();
    this.bindChat();
    this.bindWorld();
    this.bindHandbook();
    this.bindPetCare();
    this.bindTasks();
    this.bindShop();
    this.bindFriends();
    this.bindNFC();
    this.bindVoiceCall();
    this.bindApiKey();
    this.bindSheShield();
    
    this.renderAll();
  },

  // 1. 帘子开场 Intro
  bindIntro() {
    const curtains = $('intro-curtains');
    const hint = $('intro-hint');
    const title = $('intro-title');
    const fade = $('intro-fade');
    const screen = $('intro-screen');
    if (!curtains) return;

    const open = () => {
      curtains.classList.add('open');
      if (hint) hint.style.opacity = '0';
      setTimeout(() => { if (title) title.classList.add('show'); }, 400);
      setTimeout(() => { if (fade) fade.classList.add('hide'); }, 1800);
      setTimeout(() => { if (screen) screen.style.display = 'none'; }, 2400);
    };

    curtains.addEventListener('click', open);
    curtains.addEventListener('touchstart', open, { once: true });
  },

  // 2. Tab 与全屏子页面导航 Navigation
  bindNavigation() {
    // 底部 Main Tab 切换
    $$('.tab-bar .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // 快捷按钮路由
    const btnQuickMood = $('btn-quick-mood');
    if (btnQuickMood) btnQuickMood.onclick = () => this.openModal('modal-write-diary');

    const btnQuickVoice = $('btn-quick-voice');
    if (btnQuickVoice) btnQuickVoice.onclick = () => this.openFullpage('pg-voicecall');

    const btnQuickWorld = $('btn-quick-world');
    if (btnQuickWorld) btnQuickWorld.onclick = () => this.switchTab('world');

    const btnQuickShield = $('btn-quick-shield');
    if (btnQuickShield) btnQuickShield.onclick = () => this.openSheet('sheet-shield');

    // 进入仓库内网页游戏 Demo（web2d/）
    const btnGameDemo = $('btn-game-demo');
    if (btnGameDemo) btnGameDemo.onclick = () => { location.href = 'web2d/'; };

    const btnShield = $('btn-shield');
    if (btnShield) btnShield.onclick = () => this.openSheet('sheet-shield');

    // 各种进入全屏画面的 Portal
    const btnOpenChat = $('btn-open-chat');
    if (btnOpenChat) btnOpenChat.onclick = () => this.openFullpage('pg-fullchat');

    const btnOpenPetdetail = $('btn-open-petdetail');
    if (btnOpenPetdetail) btnOpenPetdetail.onclick = () => this.openFullpage('pg-petdetail');

    const btnHubPet = $('btn-hub-pet');
    if (btnHubPet) btnHubPet.onclick = () => this.openFullpage('pg-petdetail');

    const btnHubTasks = $('btn-hub-tasks');
    if (btnHubTasks) btnHubTasks.onclick = () => this.openFullpage('pg-tasks');

    const btnHubShop = $('btn-hub-shop');
    if (btnHubShop) btnHubShop.onclick = () => this.openFullpage('pg-shop');

    const btnHubFriends = $('btn-hub-friends');
    if (btnHubFriends) btnHubFriends.onclick = () => this.openFullpage('pg-friends');

    const btnHubNfc = $('btn-hub-nfc');
    if (btnHubNfc) btnHubNfc.onclick = () => this.openFullpage('pg-nfc');

    const btnHubSettings = $('btn-hub-settings');
    if (btnHubSettings) btnHubSettings.onclick = () => this.openFullpage('pg-settings');

    const btnNfcQuick = $('btn-nfc-quick');
    if (btnNfcQuick) btnNfcQuick.onclick = () => this.openFullpage('pg-nfc');

    const btnGear = $('btn-gear');
    if (btnGear) btnGear.onclick = () => this.openFullpage('pg-settings');

    // 全屏返回按钮
    $$('.pg-back').forEach(btn => {
      btn.onclick = (e) => {
        const fullpage = e.target.closest('.fullpage');
        if (fullpage) fullpage.classList.remove('active');
      };
    });
  },

  switchTab(tabName) {
    this.state.tab = tabName;
    $$('.tab-view').forEach(view => view.classList.remove('active'));
    $$('.tab-bar .tab-btn').forEach(btn => btn.classList.remove('active'));

    const activeView = $(`tab-${tabName}`);
    if (activeView) activeView.classList.add('active');

    const activeBtn = document.querySelector(`.tab-bar .tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  },

  openFullpage(id) {
    const el = $(id);
    if (el) el.classList.add('active');
  },

  openSheet(id) {
    const mask = $('mask');
    const sheet = $(id);
    if (mask) mask.classList.add('active');
    if (sheet) sheet.classList.add('active');

    const closeBtn = $('btn-sheet-close');
    if (closeBtn) closeBtn.onclick = () => this.closeSheet(id);
    if (mask) mask.onclick = () => this.closeSheet(id);
  },

  closeSheet(id) {
    const mask = $('mask');
    const sheet = $(id);
    if (mask) mask.classList.remove('active');
    if (sheet) sheet.classList.remove('active');
  },

  openModal(id) {
    const mask = $('mask');
    const modal = $(id);
    if (mask) mask.classList.add('active');
    if (modal) modal.classList.add('active');
  },

  closeModal(id) {
    const mask = $('mask');
    const modal = $(id);
    if (mask) mask.classList.remove('active');
    if (modal) modal.classList.remove('active');
  },

  // 3. AI 聊天功能 Chat
  bindChat() {
    const sendBtn = $('btn-send-fc');
    const inputField = $('text-input-fc');

    const handleSend = async () => {
      if (!inputField) return;
      const val = inputField.value.trim();
      if (!val) return;

      this.state.chatHistory.push({ who: 'me', text: val });
      inputField.value = '';
      this.renderChatMsgs();

      // 显示正在输入
      this.state.chatHistory.push({ who: 'yy', text: '牙牙正在思考中...', typing: true });
      this.renderChatMsgs();

      // 调用接口
      const reply = await this.getAIReply(val);
      // 移除 typing
      this.state.chatHistory = this.state.chatHistory.filter(m => !m.typing);
      this.state.chatHistory.push({ who: 'yy', text: reply });
      this.renderChatMsgs();
    };

    if (sendBtn) sendBtn.onclick = handleSend;
    if (inputField) {
      inputField.onkeypress = (e) => {
        if (e.key === 'Enter') handleSend();
      };
    }

    // 麦克风按住说话
    const micBtn = $('btn-mic-fc') || $('btn-mic');
    if (micBtn) {
      micBtn.onclick = () => {
        alert('🎤 语音录制已开启（演示环境模拟：牙牙正在听你说）');
      };
    }

    // 键盘切换
    const kbdBtn = $('btn-kbd-fc');
    const typeRow = $('type-row-fc');
    if (kbdBtn && typeRow) {
      kbdBtn.onclick = () => {
        typeRow.hidden = !typeRow.hidden;
      };
    }

    this.renderChatMsgs();
  },

  async getAIReply(text) {
    try {
      const localKey = localStorage.getItem('yaya_api_key') || '';
      const localBase = localStorage.getItem('yaya_api_base') || '';

      const res = await fetch(this.api.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: localKey || undefined,
          apiBase: localBase || undefined,
          messages: [
            { role: 'system', content: this.yayaPrompt },
            ...this.state.chatHistory.slice(-8).map(m => ({
              role: m.who === 'me' ? 'user' : 'assistant',
              content: m.text
            })),
            { role: 'user', content: text }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.reply) return data.reply;
      }
    } catch (e) {
      console.warn('Chat request fallback triggered:', e);
    }

    // 兜底小太阳回复
    const defaultPool = [
      '嗯嗯！我听着呢，主人继续说~ 牙牙永远在你身边哦。',
      '今天辛苦啦！遇到你真好，做我主人最棒了~',
      '收到！要不要我帮你在手账里记下来呢？',
      '抱抱主人~ 不管发生什么，牙牙都会支持你的！'
    ];
    return defaultPool[Math.floor(Math.random() * defaultPool.length)];
  },

  renderChatMsgs() {
    const container = $('fullchat-msgs');
    if (!container) return;

    container.innerHTML = this.state.chatHistory.map(m => {
      if (m.musicCard) {
        return `
          <div class="dbub yy dbub-music-card">
            <div class="mc-head">
              <span class="mc-icon">🎵</span>
              <div class="mc-info">
                <div class="mc-title">《云朵上的梦》</div>
                <div class="mc-sub">轻柔舒缓歌单 · 正为你播放中...</div>
              </div>
            </div>
            <div class="mc-wave">
              <span></span><span></span><span></span><span></span>
            </div>
          </div>
        `;
      }
      return `<div class="dbub ${m.who}">${m.text}</div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  },

  // 4. 3D 灵伴世界 World
  bindWorld() {
    const btnExplore = $('btn-start-explore');
    if (btnExplore) {
      btnExplore.onclick = () => {
        // 增加数值
        this.state.coins += 50;
        this.state.stars += 30;
        this.renderAll();

        const title = $('exp-event-title');
        const desc = $('exp-event-desc');
        const reward = $('exp-event-reward');

        if (title) title.textContent = '✨ 蘑菇森林寻宝奇遇';
        if (desc) desc.textContent = '牙牙在清晨的树荫下挖到了一个带有闪光图案的彩蛋宝箱！';
        if (reward) reward.innerHTML = '获得奖励：<strong>🪙 +50 银币 · 🌟 +30 经验</strong>';

        this.openModal('modal-explore-event');
      };
    }

    const btnConfirmExp = $('btn-confirm-explore');
    if (btnConfirmExp) btnConfirmExp.onclick = () => this.closeModal('modal-explore-event');

    const closeExpBtn = $('btn-close-explore-modal');
    if (closeExpBtn) closeExpBtn.onclick = () => this.closeModal('modal-explore-event');

    // 点击地图打卡点
    $$('.map-spot').forEach(spot => {
      spot.onclick = () => {
        const spotName = spot.querySelector('.spot-name')?.textContent || '神秘区域';
        alert(`🏰 你与牙牙来到了【${spotName}】！牙牙开心地在草地上打了个滚~`);
      };
    });

    // 快捷右侧按键
    const wsTask = $('btn-ws-task');
    if (wsTask) wsTask.onclick = () => this.openFullpage('pg-tasks');

    const wsShop = $('btn-ws-shop');
    if (wsShop) wsShop.onclick = () => this.openFullpage('pg-shop');

    const wsBag = $('btn-ws-bag');
    if (wsBag) wsBag.onclick = () => alert('🎒 背包：内有【云朵棉花糖】x2, 【星光徽章】x1');

    const wsLove = $('btn-ws-love');
    if (wsLove) wsLove.onclick = () => alert('💌 告白墙：牙牙说："昭昭是我全世界最喜欢的人！"');
  },

  // 5. 手账与健康 Handbook & Health
  bindHandbook() {
    // 切换子Tab
    $$('.hb-stab').forEach(btn => {
      btn.onclick = () => {
        $$('.hb-stab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const target = btn.getAttribute('data-hbtab');
        $$('.hb-panel').forEach(p => p.classList.remove('active'));
        const activePanel = $(`hb-panel-${target}`);
        if (activePanel) activePanel.classList.add('active');
      };
    });

    // 写日记 modal
    const btnWrite = $('btn-write-diary');
    if (btnWrite) btnWrite.onclick = () => this.openModal('modal-write-diary');

    const btnCloseDiary = $('btn-close-diary-modal');
    if (btnCloseDiary) btnCloseDiary.onclick = () => this.closeModal('modal-write-diary');

    // 提交日记
    const btnSubmitDiary = $('btn-submit-diary');
    if (btnSubmitDiary) {
      btnSubmitDiary.onclick = () => {
        const input = $('diary-text-input');
        const val = input ? input.value.trim() : '';
        if (!val) { alert('请写下一点今天想说的话哦~'); return; }

        this.state.diaryEntries.unshift({
          date: '今天 · 刚记录',
          mood: '😄',
          weather: '☀️ 31°C',
          text: val
        });

        if (input) input.value = '';
        this.closeModal('modal-write-diary');
        this.renderTimeline();
        alert('💕 手账保存成功！已同步至牙牙的记忆库中~');
      };
    }

    // 极简 Sparkline
    const spark = $('sparkline');
    if (spark) {
      const points = '0,30 25,18 50,38 75,12 100,28 125,8 150,22 175,15 200,32 225,10 250,20 275,6 300,18';
      spark.setAttribute('points', points);
    }

    // FAB 添加健康数据
    const fabHealth = $('btn-add-health');
    if (fabHealth) {
      fabHealth.onclick = () => {
        alert('🩸 健康数据已记录：睡眠 7.5小时，情绪状态良好！');
      };
    }
  },

  renderTimeline() {
    const container = $('timeline');
    if (!container) return;

    container.innerHTML = this.state.diaryEntries.map(e => `
      <div class="tl-card">
        <div class="tl-head">
          <span>${e.mood} ${e.date}</span>
          <span class="tl-weather">${e.weather}</span>
        </div>
        <div class="tl-body">${e.text}</div>
      </div>
    `).join('');
  },

  // 6. 宠物互动与照顾 Pet Care
  bindPetCare() {
    const triggerCare = (msg, addExp) => {
      this.state.intimacy += addExp;
      this.renderAll();
      alert(`🐾 ${msg}！亲密度 +${addExp} (当前：${this.state.intimacy})`);
    };

    const feed = $('btn-care-feed');
    if (feed) feed.onclick = () => triggerCare('给牙牙喂食了甜甜圈', 20);

    const bathe = $('btn-care-bathe');
    if (bathe) bathe.onclick = () => triggerCare('帮牙牙洗了个暖暖的泡泡澡', 25);

    const dress = $('btn-care-dress');
    if (dress) dress.onclick = () => this.openFullpage('pg-shop');

    const pet = $('btn-care-pet');
    if (pet) pet.onclick = () => triggerCare('温柔地抚摸了牙牙的绒毛', 30);
  },

  // 7. 任务 Task Center
  bindTasks() {
    const listContainer = $('task-list-container');
    if (!listContainer) return;

    this.renderTasks();
  },

  renderTasks() {
    const listContainer = $('task-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = this.state.tasks.map(t => `
      <div class="task-item">
        <div class="ti-info">
          <div class="ti-title">${t.title}</div>
          <div class="ti-sub">奖励：🌟 +${t.exp} 经验 · 🪙 +${t.coin} 银币</div>
        </div>
        <button class="btn-task-go ${t.done ? 'done' : ''}" onclick="App.completeTask(${t.id})">
          ${t.done ? '已完成' : '去完成'}
        </button>
      </div>
    `).join('');
  },

  completeTask(id) {
    const t = this.state.tasks.find(item => item.id === id);
    if (!t) return;
    if (t.done) return;

    t.done = true;
    this.state.coins += t.coin;
    this.state.stars += t.exp;
    this.renderAll();
    this.renderTasks();
    alert(`🎉 任务完成！获得 🪙 +${t.coin} 银币, 🌟 +${t.exp} 经验！`);
  },

  // 8. 商城 Shop
  bindShop() {
    this.renderShop();
  },

  renderShop() {
    const container = $('shop-grid-container');
    if (!container) return;

    container.innerHTML = this.state.shopItems.map(item => `
      <div class="shop-card">
        <div class="sc-img">${item.icon}</div>
        <div class="sc-name">${item.name}</div>
        <div class="sc-price">🪙 ${item.price}</div>
        <button class="btn-buy" onclick="App.buyShopItem('${item.id}')">
          ${item.equipped ? '已装备' : (item.owned ? '装备' : '购买')}
        </button>
      </div>
    `).join('');
  },

  buyShopItem(id) {
    const item = this.state.shopItems.find(i => i.id === id);
    if (!item) return;

    if (item.owned) {
      this.state.shopItems.forEach(i => i.equipped = false);
      item.equipped = true;
      this.renderShop();
      alert(`✨ 已成功为您更换装扮【${item.name}】！`);
      return;
    }

    if (this.state.coins < item.price) {
      alert('🪙 银币不够了哦，快去完成每日任务获取银币吧！');
      return;
    }

    this.state.coins -= item.price;
    item.owned = true;
    item.equipped = true;
    this.renderAll();
    this.renderShop();
    alert(`🛍️ 成功购买【${item.name}】！`);
  },

  // 9. 好友 Friends
  bindFriends() {
    const btnAdd = $('btn-add-friend');
    if (btnAdd) {
      btnAdd.onclick = () => {
        const names = ['草莓小福', '软软泡泡', '微风甜桃', '小熊饼干'];
        const randomName = names[Math.floor(Math.random() * names.length)];
        this.state.friends.push({
          id: 'f' + Date.now(),
          name: randomName,
          status: '刚刚在线 · 成为你的新朋友',
          avatar: '🌸',
          visited: false
        });
        this.renderFriends();
        alert(`🌸 已成功添加朋友【${randomName}】！`);
      };
    }

    this.renderFriends();
  },

  renderFriends() {
    const container = $('friends-list-container');
    if (!container) return;

    container.innerHTML = this.state.friends.map(f => `
      <div class="friend-item">
        <div class="fi-avatar">${f.avatar}</div>
        <div class="fi-info">
          <div class="fi-name">${f.name}</div>
          <div class="fi-sub">${f.status}</div>
        </div>
        <button class="btn-visit" onclick="App.visitFriend('${f.id}')">
          ${f.visited ? '已拜访' : '拜访小屋'}
        </button>
      </div>
    `).join('');
  },

  visitFriend(id) {
    const f = this.state.friends.find(item => item.id === id);
    if (!f) return;
    f.visited = true;
    this.renderFriends();
    alert(`🏠 你来到了【${f.name}】的小屋串门，留下一朵温馨的小花~`);
  },

  // 10. NFC 绑定 Simulator
  bindNFC() {
    const btnSim = $('btn-sim-nfc') || $('nfc-ripple-btn');
    const msg = $('nfc-status-msg');

    if (btnSim) {
      btnSim.onclick = () => {
        if (msg) {
          msg.textContent = '✅ 碰一碰通信成功！已绑定玩偶 [牙牙 · NO.8829]';
          msg.style.color = '#4CAF50';
        }
        alert('📱 NFC 碰一碰成功！玩偶数据已同步至云端与小程序。');
      };
    }
  },

  // 11. 语音通话 Simulation
  bindVoiceCall() {
    const endBtn = $('btn-vc-end');
    if (endBtn) {
      endBtn.onclick = () => {
        this.openFullpage('pg-voicecall'); // Toggle/close
        const vc = $('pg-voicecall');
        if (vc) vc.classList.remove('active');
      };
    }
  },

  // 12. 贴心守护 She Shield
  bindSheShield() {
    const emCall = $('btn-call-em');
    if (emCall) emCall.onclick = () => alert('🆘 正在呼叫您的紧急联系人：妈妈 (138****8888)...');

    const policeCall = $('btn-call-110');
    if (policeCall) policeCall.onclick = () => alert('📞 正在为您拨打 110 紧急警务热线...');

    const justTalk = $('btn-just-talk');
    if (justTalk) {
      justTalk.onclick = () => {
        this.closeSheet('sheet-shield');
        this.openFullpage('pg-fullchat');
      };
    }
  },

  // 13. DeepSeek Key 配置
  bindApiKey() {
    const inp = $('input-api-key');
    const baseInp = $('input-api-base');
    const btn = $('btn-save-key');
    const msg = $('key-status-msg');
    if (!inp || !btn) return;

    const savedKey = localStorage.getItem('yaya_api_key');
    const savedBase = localStorage.getItem('yaya_api_base');
    if (savedKey) inp.value = savedKey;
    if (savedBase && baseInp) baseInp.value = savedBase;
    if (savedKey && msg) {
      msg.textContent = '已自动加载保存的 DeepSeek 密钥';
      msg.style.color = '#4CAF50';
    }

    btn.onclick = () => {
      const val = inp.value.trim();
      const baseVal = baseInp ? baseInp.value.trim() : '';

      if (val) {
        localStorage.setItem('yaya_api_key', val);
        if (msg) { msg.textContent = '✓ DeepSeek API Key 已保存！即刻生效。'; msg.style.color = '#4CAF50'; }
      } else {
        localStorage.removeItem('yaya_api_key');
        if (msg) { msg.textContent = '已清除密钥'; msg.style.color = '#888'; }
      }

      if (baseVal) {
        localStorage.setItem('yaya_api_base', baseVal);
      } else {
        localStorage.removeItem('yaya_api_base');
      }
    };
  },

  // 渲染整体数值
  renderAll() {
    const coinEl = $('res-coin');
    if (coinEl) coinEl.textContent = this.state.coins;

    const starEl = $('res-star');
    if (starEl) starEl.textContent = this.state.stars;

    const gemEl = $('res-gem');
    if (gemEl) gemEl.textContent = this.state.gems;

    const shopCoin = $('shop-coin-cnt');
    if (shopCoin) shopCoin.textContent = this.state.coins;
  }
};

// 页面加载完成后启动应用
document.addEventListener('DOMContentLoaded', () => App.init());
