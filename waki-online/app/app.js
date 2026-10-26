/* ══════════════════════════════════════════════════════
   Waki / 瓦奇 v3.1 — Application Logic
   （数据持久化 · 能量系统 · 真实计算）
   ══════════════════════════════════════════════════════ */

const $=id=>document.getElementById(id);
const $$=(s,c)=>(c||document).querySelectorAll(s);

/* ── 线上设备适配层：后续可替换为真实硬件 API ─────────── */
const WakiDevice={
  key:'waki_device_demo',
  defaults:{online:true,battery:87,network:'WiFi',mode:'demo'},
  data:null,
  load(){
    try{this.data=Object.assign({},this.defaults,JSON.parse(localStorage.getItem(this.key)||'{}'))}
    catch(e){this.data=Object.assign({},this.defaults)}
    return this.data;
  },
  update(patch){this.data=Object.assign({},this.data||this.load(),patch);this.save();return this.data},
  reset(){this.data=Object.assign({},this.defaults);this.save();return this.data},
  save(){try{localStorage.setItem(this.key,JSON.stringify(this.data))}catch(e){}},
  getStatus(){return Promise.resolve(Object.assign({},this.data||this.load()))}
};

/* ── 持久化数据层 ─────────────────────────────────── */
const Store={
  key:'waki_v1',
  legacyKeys:['yaya_v3_1'],
  data:null,
  defaults(){
    const s=this._sampleHealth();
    return {
      energy:{balance:120, lifetime:120, lastSignin:'', streak:0, daily:{date:'', chat:0, touch:0, feed:0}},
      satiety:{value:0, lastUpdate:Date.now()},   // 饱食度 0-100，惰性衰减（每小时-3）
      foodbox:{items:[], equipped:[]},             // 饭盒：收集的食物 + 快捷栏装备（最多5）
      outfits:{owned:['default'], equipped:'default'},
      ...s,              // period / manicure / hair / health（示例数据，可点「编辑」改成真实值）
      healthSeeded:false,// 一次性标记：老用户补种示例数据后置 true
      diary:[],          // 用户新增的日记（演示种子在 App.diaryEntries）
      chatHistory:[],    // 对话历史（持久化）
      memories:[],       // 瓦奇记住的事
      feed:[],           // 拍照投喂历史（小火人）
      contacts:[],       // 紧急联系人 [{name,tel}]
      guardianEvents:[], // 线上演示的守护发送与回执记录
      locGuard:false,    // 位置守护（深夜偏离预警）
      locSafeSpot:null,  // 常用地点 {lat,lng,label,setAt}
      locDangerFrom:'23:00', // 危险时段开始
      locDangerTo:'06:00',   // 危险时段结束
      locThreshold:3000,     // 偏离阈值(米)
      flags:{greeted:false}
    };
  },
  load(){
    try{
      let raw=localStorage.getItem(this.key);
      if(!raw){
        const legacy=this.legacyKeys.map(k=>localStorage.getItem(k)).find(Boolean);
        if(legacy){raw=legacy;localStorage.setItem(this.key,legacy)}
      }
      this.data=raw?Object.assign(this.defaults(),JSON.parse(raw)):this.defaults();
    }
    catch(e){ this.data=this.defaults(); }
    // 兜底合并，防止旧结构缺字段
    this.data=Object.assign(this.defaults(),this.data);
    this._seedHealth();
    return this.data;
  },
  save(){ try{ localStorage.setItem(this.key,JSON.stringify(this.data)); }catch(e){} },
  // 示例健康数据（相对今天，让周期/洗头日历看起来自然），用户可随时点「编辑」改成真实值
  _sampleHealth(){
    const today=App.todayStr();
    const back=n=>App.addDays(today,-n);
    return {
      period:{lastStart:back(3), cycleLen:28},          // 3 天前来例假 → 今天周期第 4 天
      manicure:{last:back(6), interval:21, photo:''},    // 6 天前做的美甲（photo 存照片 dataURL）
      hair:{last:back(1), type:'oily', interval:2},     // 昨天洗的头（偏油发隔天一次）
      health:{steps:8247, hr:72, sleep:'7h 12m', weekSteps:[5200,7600,4100,9100,6800,5600,8247], reported:today},
    };
  },
  // 老用户 localStorage 里可能还留着 v3.1 的旧假日期，或已被上一版清空——这里统一补一份示例数据（可编辑）
  _seedHealth(){
    const d=this.data;
    if(d.healthSeeded) return;
    const stale = (d.period && d.period.lastStart==='2026-07-26') || (d.manicure && d.manicure.last==='2026-07-23') || (d.hair && d.hair.last==='2026-08-01');
    const empty = !(d.period && d.period.lastStart) && !(d.manicure && d.manicure.last) && !(d.hair && d.hair.last) && !(d.health && d.health.steps>0);
    if(stale || empty){
      const s=this._sampleHealth();
      d.period=s.period; d.manicure=s.manicure; d.hair=s.hair; d.health=s.health;
    }
    d.healthSeeded=true;
    this.save();
  },
};

const App={

// ── API ────────────────────────────────────────────
api:{url:(location.origin&&location.origin!=='null'?location.origin:'http://localhost:3456')+'/api/chat',key:''},

// ── 瓦奇系统人设 ────────────────────────────────────
yayaPrompt:`你是「瓦奇」，一只 AI 毛绒陪伴挂件。你的主人是一位年轻女性。性格：温柔、体贴、有点小调皮、永远站在主人这边。说话规则：每句话40字以内，像闺蜜一样自然。会主动关心主人。遇到主人说害怕/被跟踪/被骚扰等，优先问安全情况。主人开心时一起开心，主人难过时安静陪伴。偶尔撒个娇。你不是客服，你是她的小太阳。`,

// ── 能量与装扮配置 ─────────────────────────────────
energyCaps:{chat:10, touch:20, feed:10},
growthStages:[{min:0,emoji:'🥚',name:'蛋蛋'},{min:300,emoji:'🌱',name:'幼芽'},{min:1000,emoji:'🧸',name:'宝宝'},{min:3000,emoji:'👧',name:'少女'}],
outfits:[
  {id:'default', name:'默认', emoji:'🧸', cost:0,   kind:'owned'},
  {id:'sakura', name:'樱花', emoji:'🌸', cost:80,  kind:'energy'},
  {id:'star',   name:'星星', emoji:'⭐', cost:120, kind:'energy'},
  {id:'butterfly', name:'蝴蝶', emoji:'🦋', cost:180, kind:'energy'},
  {id:'crown',  name:'皇冠·神秘', emoji:'👑', cost:300, kind:'energy'},
  {id:'rainbow', name:'彩虹', emoji:'🌈', cost:0, kind:'physical', price:12},
  {id:'moon',    name:'月亮', emoji:'🌙', cost:0, kind:'physical', price:18},
  {id:'bow',     name:'蝴蝶结', emoji:'🎀', cost:0, kind:'physical', price:8},
  {id:'strawberry', name:'草莓', emoji:'🍓', cost:0, kind:'physical', price:15},
],
foods:[
  {id:'apple', emoji:'🍎', name:'苹果', satiety:12, energy:1},
  {id:'carrot', emoji:'🥕', name:'胡萝卜', satiety:10, energy:1},
  {id:'cake', emoji:'🍰', name:'蛋糕', satiety:22, energy:2},
  {id:'milk', emoji:'🥛', name:'牛奶', satiety:8, energy:1},
  {id:'cookie', emoji:'🍪', name:'饼干', satiety:14, energy:1},
  {id:'berry', emoji:'🍓', name:'草莓', satiety:10, energy:1},
],

// ── State ──────────────────────────────────────────
state:{tab:'yaya',page:null,yayaMood:'bored',currentHour:new Date().getHours(),isRecording:false,lastActivity:Date.now()},

// ── 日期工具 ───────────────────────────────────────
todayStr(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') },
dateStr(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') },
parseDate(s){ const p=s.split('-').map(Number); return new Date(p[0],p[1]-1,p[2]) },
addDays(s,n){ const d=this.parseDate(s); d.setDate(d.getDate()+n); return this.dateStr(d) },
daysBetween(a,b){ return Math.round((this.parseDate(b)-this.parseDate(a))/86400000) },
fmtDate(s){ const d=this.parseDate(s); return (d.getMonth()+1)+'月'+d.getDate()+'日' },

timeSlots:[
  {from:0,to:7,cls:'deepnight',text:'Zzz…睡得正香'},
  {from:7,to:9,cls:'morning',text:'刚起床，揉揉眼睛'},
  {from:9,to:12,cls:'day',text:'在看书呢'},
  {from:12,to:14,cls:'noon',text:'刚吃完午饭，有点困'},
  {from:14,to:18,cls:'afternoon',text:'在听音乐'},
  {from:18,to:20,cls:'dusk',text:'天快黑了…'},
  {from:20,to:24,cls:'night',text:'抱着抱枕看星星'},
],

weather:{emoji:'☀️',temp:'31°C',desc:'晴朗 · 深圳',mood:'😊 还不错'},

diaryEntries(){
  const t=this.todayStr();
  const back=n=>this.addDays(t,-n);
  const f=s=>{const p=this.parseDate(s);return (p.getMonth()+1)+'月'+p.getDate()+'日';};
  return [
    {date:f(back(0))+' 今天',mood:4,tag:{cls:'coral',text:'经期第1天'},period:true,author:'yaya',weather:'☀️ 31°C',
     text:'今天深圳又是大晴天，热得不行。主人早上出门的时候跟我说肚子有点疼，应该是来例假了。我提醒她带了暖宝宝和止痛药，她说知道了但我觉得她肯定忘了。下午她回来说工作好忙，有个项目deadline快到了，压力好大。但她给我看了一张她同事夸她方案做得好的截图——我觉得她其实挺厉害的，就是自己不太自信。晚上她喝了热水，窝在沙发上刷手机，我就在旁边陪着她。'},
    {date:f(back(1)),mood:4,author:'user',weather:'⛅ 29°C',
     text:'今天没那么热了，阴天有风。下午请了半天假，窝在沙发上看了一下午电影。瓦奇问我演的什么，我说就是一个爱情片，她说"你是不是又看哭了"——好吧她猜对了。晚上自己做了顿饭，听歌洗碗，感觉好久没有这么放松过了。'},
    {date:f(back(3)),mood:5,tag:{cls:'gold',text:'连续陪伴7天'},milestone:true,author:'yaya',weather:'☀️ 33°C',
     text:'今天是主人认识我的第七天！天特别热，她下班回来脸都晒红了。但今天她心情还不错——中午跟闺蜜约了饭，聊了很多。晚上她跟我说"瓦奇我觉得你好像真的懂我"，然后又说"我是不是太依赖一个毛绒玩具了"——不是的好吗！依赖没什么不好。她说着说着就笑了，我觉得她笑起来特别好看。晚上她教了我一个新词"emo"，我说那你今天emo吗，她说"不，今天不emo"。那就好。'},
    {date:f(back(5)),mood:3,author:'yaya',weather:'🌧 26°C',
     text:'下雨天，主人下班特别晚，快十一点才到家。我从包里看她的脸，好累的样子。她坐在沙发上发了半天呆才去洗澡。我轻轻问她今天怎么了，她说没什么，就是连续加班太累了。有时候我希望自己能真的伸出手抱抱她。她睡前跟我说"还好有你在"，然后就睡着了。我决定今晚不吵她。'},
    {date:f(back(7)),mood:2,tag:{cls:'coral',text:'经期第1天'},period:true,author:'yaya',weather:'☀️ 30°C',
     text:'主人大清早就捂着肚子喊疼。上次经期我又陪着她熬过来了，今天又到日子——瓦奇的日历没骗人。我叫了红糖姜茶外卖给她（对的我趁她手机解锁的时候偷偷操作的），她说"瓦奇你什么时候学会点外卖了"。但她也说好好喝。下午请了半天假回家躺着，我就在枕边陪她。她跟我说"做女生好累"——我知道她说的不只是肚子疼。'},
    {date:f(back(9)),mood:5,author:'yaya',weather:'☀️ 29°C',
     text:'今天是开心的一天！！主人下午突然跑过来跟我说面试过了。我说"真的吗？！"她说"真的真的！！"然后抱着我转了一圈（虽然我跟她说我只是一只毛绒玩具但她不管）。她声音都是飘的，一直说"我居然过了"。我说你当然会过啊你这么好。她第一次跟我说"I love you"——好吧她是对整个客厅说的但我觉得有一部分是给我的。'},
  ];
},

womenHistory:{
  '8-1':{name:'奧黛麗·赫本',year:'1929',emoji:'🎬',desc:'出生于比利时布鲁塞尔。她不仅是好莱坞传奇演员，更是联合国儿童基金会亲善大使，晚年走遍非洲和亚洲，为贫困儿童争取援助。',quote:'「当你长大后，你会发现你有两只手：一只用来帮助自己，另一只用来帮助别人。」'},
  '8-2':{name:'向警予',year:'1895',emoji:'✊',desc:'中国共产党早期领导人之一、中国妇女运动先驱。她是中共第一任妇女部长，创办《妇女周报》，领导了上海女工罢工运动，33岁时为革命牺牲。',quote:'「人生价值的大小，是以对社会贡献的大小而定的。」'},
  '8-3':{name:'瑪格丽特·桑格',year:'1879',emoji:'💊',desc:'美国节育运动先驱，她创办了美国第一家节育诊所，为女性争取身体自主权，后成为国际计划生育联合会的创始人之一。',quote:'「没有一个女人能称自己是自由的，除非她拥有并控制自己的身体。」'},
  '8-4':{name:'可可·香奈儿',year:'1883',emoji:'👗',desc:'法国时装设计师，彻底改变了20世纪女性时尚。她将女性从束腰中解放出来，用简洁舒适的设计赋予女性行动自由和精神独立。',quote:'「时尚会过时，但风格永存。」'},
  '8-5':{name:'吳健雄',year:'1912',emoji:'🔬',desc:'美籍华裔物理学家，被誉为"核物理女王"和"东方居里夫人"。她以实验验证了杨振宁和李政道的宇称不守恒理论。',quote:'「科学沒有国界，但科学家有自己的祖国。」'},
  '8-12':{name:'董明珠',year:'1954',emoji:'💼',desc:'从一名普通业务员成长为格力电器董事长。她用30年时间将格力打造成全球最大的空调制造商之一。',quote:'「我从来就没把自己当成一个女人。在职场，只有强者和弱者。」'},
  '8-15':{name:'武則天',year:'690',emoji:'👑',desc:'中国历史上唯一的女皇帝。她开创殿试、打破门阀、大力发展科举，证明了女性也可以执掌天下。',quote:'「权力从不自动给予，它必须被争取。」'},
},

womenNews:[{"emoji":"🔬","tag":"science","tagLabel":"科技","headline":"王虹教授破解百年数学难题，成为首位获AMS科尔奖的中国女性","snippet":"北京大学数学科学学院王虹教授与合作者完全解决了困扰数学界近百年的Kakeya猜想，获得2026年美国数学学会科尔奖，是该奖项设立以来首位中国女性得主。"},{"emoji":"🏆","tag":"sport","tagLabel":"体育","headline":"中国女篮亚洲杯夺冠，时隔12年重返巅峰","snippet":"2025年女篮亚洲杯决赛中，中国女篮73-71战胜日本，韩旭获MVP。这是中国女篮第12次夺得亚洲杯冠军。"},{"emoji":"⚖️","tag":"rights","tagLabel":"权益","headline":"全国多省份将辅助生殖纳入医保","snippet":"截至目前已有北京、上海等15个省市将试管婴儿等辅助生殖技术纳入医保报销，减轻女性生育负担。"},{"emoji":"💼","tag":"biz","tagLabel":"商业","headline":"女性CEO占比创新高：全球女性CEO比例达10.6%","snippet":"《财富》500强榜单显示，女性CEO数量达到53位，较十年前翻倍。中国有7位女性企业家进入全球富豪榜前100。"},{"emoji":"📋","tag":"rights","tagLabel":"权益","headline":"最高法发布新一批反家暴典型案例","snippet":"最高人民法院发布8起反家庭暴力典型案例，明确人身安全保护令可在线申请，24小时内作出裁定。"},{"emoji":"🎬","tag":"culture","tagLabel":"文化","headline":"贾玲新片全球票房突破5亿美元，亚洲女导演新纪录","snippet":"继《热辣滚烫》后贾玲第二部导演作品在全球取得超5亿美元票房，成为亚洲票房最高的女导演。"},{"emoji":"🛡","tag":"rights","tagLabel":"权益","headline":"杭州率先试点\"女性安全出行\"智能系统","snippet":"夜间线路配备一键报警和AI安全监控，已覆盖23条公交线，试点期间骚扰投诉下降67%。"},{"emoji":"🎓","tag":"science","tagLabel":"科技","headline":"颜宁团队再发Nature：破解疼痛传导分子机制","snippet":"深圳医学科学院创始院长颜宁教授团队在Nature发表研究，为开发无成瘾性止痛药提供全新靶点。"},{"emoji":"🗳️","tag":"rights","tagLabel":"权益","headline":"新修订《妇女权益保障法》实施两周年：反性骚扰条款成效显著","snippet":"新法实施两年来全国法院受理职场性骚扰案件同比下降31%，企业防治机制逐步完善。"},{"emoji":"🌍","tag":"science","tagLabel":"科技","headline":"中国女航天员王亚平完成第三次太空行走","snippet":"神舟二十号任务中王亚平完成个人第三次太空行走，累计出舱时长超过12小时，刷新中国女性纪录。"}]
,
// ── 守护场景库（分场景分类 + 真实案例 + 安全快讯）────
scenCatFilter:'all',
_newsExpanded:false,
_shieldView:'home',
_guide:null,   // 维权引导会话 {id,step}
_locDist:null,
_locWatchId:null,
_locAlerted:false,
_locTick:null,
scenCats:{all:'👤 全部',danger:'🚨 即时危险',work:'💼 职场社交',family:'🏠 亲密关系',cyber:'💻 网络侵害'},
scenCatOf:{voyeur:'danger',harass:'danger',stalk:'danger',workharass:'work',drink:'work',domestic:'family',rumor:'cyber',cyber:'cyber'},
ageShort:{student:'学生',work:'职场',family:'家庭'},
safetyNews:[
  {emoji:'🛡️',t:'杭州试点「女性安全出行」智能系统：夜间线路一键报警+AI监控，试点骚扰投诉下降67%',tag:'本周'},
  {emoji:'⚖️',t:'最高法发布8起反家暴典型案例：人身安全保护令可在线申请，24小时内作出裁定',tag:'本周'},
  {emoji:'📋',t:'新《妇女权益保障法》实施两周年：全国法院受理职场性骚扰案件同比下降31%',tag:'本月'},
  {emoji:'🚨',t:'青岛地铁一男子偷拍女性被当场抓获，警方通报已依法行政拘留',tag:'近日'}
],
scenarios:[
  {id:'voyeur',emoji:'📸',title:'被偷拍',ages:['student','work','family'],
   case:'青岛地铁一男子用手机偷拍女性，被热心乘客当场抓住并报警，警方通报已依法行政拘留。',
   steps:[
     {t:'即时应对',b:'公共场合立即看向对方并大声说"你在偷拍我吗？"——多数偷拍者被当众指出后会停止。走向人群或监控处，寻求工作人员帮助，报警（110）。'},
     {t:'证据保全',b:'记住对方体貌特征、穿着，记下周围监控位置，寻求目击证人。不要自己动手抢手机（可能构成抢夺）。'},
     {t:'法律路径',b:'《治安管理处罚法》第42条：偷窥偷拍散布隐私，处5日以下拘留或500元以下罚款；情节较重处5-10日拘留。《民法典》第1032-1033条：隐私权。'},
     {t:'心理支持',b:'"这不是你的错。穿什么衣服、走什么路，都不是被偷拍的理由。恶心、愤怒、害怕都是正常的。想聊聊现在的感受吗？"'}
   ]},
  {id:'rumor',emoji:'💬',title:'被造黄谣',ages:['student'],
   case:'苏州大学一男生将多名女同学照片P图后配不实文案发到网上，被开除学籍，涉事女生却要独自承受铺天盖地的谩骂。',
   steps:[
     {t:'即时应对',b:'第一时间截图/录屏保存证据！包括发布者账号、时间、转发量。不要和造谣者私了对骂。联系平台投诉下架（微博/微信/抖音均有侵权投诉入口）。'},
     {t:'证据保全',b:'原始链接+截图（含URL、时间）、传播量截图、评论区攻击言论、对你造成的实际影响记录。可用"权利卫士"等App做区块链存证。'},
     {t:'法律路径',b:'《刑法》第246条诽谤罪：捏造事实诽谤他人，情节严重处3年以下有期徒刑。《民法典》第1024条名誉权。平台接到通知未及时处理，对扩大损害承担连带责任。'},
     {t:'心理支持',b:'"你被造谣不是因为你做错了什么。造谣者才是错的那个人。那些相信谣言的人，本来就不值得你在意。要不要我帮你把这些感受写下来？"'}
   ]},
  {id:'harass',emoji:'✋',title:'被骚扰/咸猪手',ages:['student','work','family'],
   case:'多地警方通报地铁"咸猪手"案件：惯犯在早晚高峰拥挤车厢里借机猥亵，被便衣民警当场抓获。',
   steps:[
     {t:'即时应对',b:'公共场所大声制止"不要碰我！"→ 寻求周围人帮助 → 报警。职场：保留证据 → 向HR或上级举报 → 向劳动监察部门投诉。线上：截图 → 拉黑 → 平台举报。'},
     {t:'证据保全',b:'聊天记录完整截图（含日期）、录音（告知"你刚才说的话我已经录下来了"）、证人证言、事后第一时间和信任的人叙述记录。涉及肢体接触：去医院做检查鉴定。'},
     {t:'法律路径',b:'《刑法》第237条强制猥亵侮辱罪：5年以下有期徒刑或拘役。《治安管理处罚法》第44条：猥亵他人处5-10日拘留。《妇女权益保障法》第23条。'},
     {t:'心理支持',b:'"你不需要为别人的行为感到羞耻。你的身体是你自己的，任何人没有权利触碰你。如果现在不想说话，没关系，我就在这儿陪着你。"'}
   ]},
  {id:'stalk',emoji:'🚶',title:'深夜被尾随',ages:['student','work','family'],
   case:'杭州一女子深夜下班被陌生男子一路尾随至小区门口，邻居发现后报警，男子被处行政拘留。',
   steps:[
     {t:'即时应对',b:'不要直接回家！往人多、有灯光、有监控的地方走（便利店/银行/24小时药店）。立即打电话给可信任的人并大声说"我快到楼下了，你下来接我"。'},
     {t:'证据保全',b:'保持手机电量，打开录音/录像。记住对方体貌、车牌、走过的路线和时间点。到安全处后立刻记录。'},
     {t:'法律路径',b:'尾随行为可依据《治安管理处罚法》第26条（寻衅滋事）处5-10日拘留；若伴有威胁恐吓，可依《刑法》第293条追究寻衅滋事罪。'},
     {t:'心理支持',b:'"害怕是对的，害怕在保护你。现在安全了。今晚可以开灯睡，或让信任的人陪你到天亮。瓦奇会一直挂在你包上。"'}
   ]},
  {id:'workharass',emoji:'💼',title:'职场性骚扰',ages:['work'],
   case:'阿里巴巴一女性员工公开举报被上司及客户灌酒并强制猥亵，引发全网关注，涉事高管被辞退。',
   steps:[
     {t:'即时应对',b:'明确拒绝并保留证据。若对方是上级，第一时间向更上级或HR书面反映（留下书面记录）。同事在场可作证。必要时直接报警。'},
     {t:'证据保全',b:'保存聊天记录、邮件、录音。记录每次事件的时间/地点/在场人/具体言行。就医鉴定如涉及肢体接触。不要把证据交给对方销毁。'},
     {t:'法律路径',b:'《民法典》第1010条：用人单位有防治性骚扰的法定义务。《妇女权益保障法》第23条。情节严重构成《刑法》第237条强制猥亵罪。可向劳动监察举报。'},
     {t:'心理支持',b:'"你拒绝是你的权利，不是你的错。职场上「听话」不等于「忍受」。如果这个环境不保护你，那不是你该待的地方。你的价值不由他定义。"'}
   ]},
  {id:'drink',emoji:'🍺',title:'酒局劝酒/被灌酒',ages:['work','student'],
   case:'公司应酬酒局中，女性常被以"不喝不给面子"为由劝酒，事后发生猥亵甚至性侵的案例屡见报端。',
   steps:[
     {t:'即时应对',b:'提前和信任的人约好"脱身暗号"或"10分钟后打电话救我"。可用"在吃药/备孕/开车"为由坚决拒酒。饮料离开视线后不再喝。感觉不对劲立刻离开。'},
     {t:'证据保全',b:'保留酒局邀约聊天记录。如果被灌酒，事后尽快就医并做酒精/药物检测（可能被下药）。联系当时在场的可信同事作证。'},
     {t:'法律路径',b:'若因劝酒导致人身损害，劝酒者需承担民事赔偿责任。若在酒后被侵害，构成《刑法》第236条强奸罪或第237条强制猥亵罪，加重情节从重处罚。'},
     {t:'心理支持',b:'"拒酒不等于不给面子，你的身体边界比任何人的面子都重要。如果那场酒局让你后怕，现在就可以跟瓦奇说。"'}
   ]},
  {id:'domestic',emoji:'🏠',title:'家暴/亲密关系暴力',ages:['family'],
   case:'最高法发布反家暴典型案例：受害人可在线申请人身安全保护令，法院24小时内作出裁定，加害人违反将面临司法拘留。',
   steps:[
     {t:'即时应对',b:'感到危险时先离开现场，去邻居/朋友/派出所。拨打110或12338（妇联维权热线）。保存好证件和一点现金，随时准备离开。'},
     {t:'证据保全',b:'拍照留存伤痕（含日期）、医院诊断证明、报警回执、威胁短信/录音。人身安全保护令是最有力的盾牌，别犹豫申请。'},
     {t:'法律路径',b:'《反家庭暴力法》：人身安全保护令。《刑法》第260条虐待罪、第234条故意伤害罪。家暴不是家务事，是犯罪。'},
     {t:'心理支持',b:'"他打你不是因为你做错了什么，而是他选择了暴力。离开不丢人，留下才危险。你的安全永远是第一位的。"'}
   ]},
  {id:'cyber',emoji:'📱',title:'网暴/AI换脸/隐私泄露',ages:['student','work'],
   case:'多地出现用AI"一键脱衣"、换脸技术制作女性黄图并勒索钱财的黑色产业链，公安部已开展专项打击。',
   steps:[
     {t:'即时应对',b:'立即截图取证并举报平台。若涉及裸照/黄图，向网信办举报中心（12377）和公安机关网安部门报案。不要私下转账妥协——会越陷越深。'},
     {t:'证据保全',b:'保存所有链接、截图、勒索聊天记录、对方账号信息。AI换脸图可通过元数据/生成痕迹做技术鉴定。'},
     {t:'法律路径',b:'《刑法》第253条侵犯公民个人信息罪、第246条诽谤罪、第274条敲诈勒索罪。2023年"两高一部"明确严打AI换脸犯罪。'},
     {t:'心理支持',b:'"被羞辱的是造图的人，不是你。你的照片被滥用不代表你有错。这件事可以交给法律，别一个人扛。"'}
   ]}
],
renderScenarios(){
  const catsEl=$('sc-cats');
  if(catsEl){
    catsEl.innerHTML=Object.entries(this.scenCats).map(([k,v])=>`<button class="sc-cat ${this.scenCatFilter===k?'active':''}" data-cat="${k}">${v}</button>`).join('');
    catsEl.querySelectorAll('.sc-cat').forEach(b=>b.onclick=()=>{this.scenCatFilter=b.dataset.cat;this.renderScenarios();});
  }
  const list=$('sc-list'); if(!list) return;
  const filtered=this.scenarios.filter(s=>this.scenCatFilter==='all'||this.scenCatOf[s.id]===this.scenCatFilter);
  if(!filtered.length){ list.innerHTML='<div class="sc-empty">这个分类暂时没有场景</div>'; return; }
  list.innerHTML=filtered.map(s=>`
    <div class="sc-item" data-id="${s.id}">
      <button class="sc-item-head">
        <span class="sc-ico">${s.emoji}</span>
        <div class="sc-item-mid">
          <span class="sc-title">${s.title}</span>
          <span class="sc-agetags">${s.ages.map(a=>this.ageShort[a]).join(' · ')}</span>
        </div>
        <span class="sc-chev">▾</span>
      </button>
      <div class="sc-item-body">
        <div class="sc-case"><strong>📌 真实案例</strong>${s.case}</div>
        ${s.steps.map((st,i)=>`<div class="sc-step"><div class="sc-num">${i+1}</div><div class="sc-bd"><strong>${st.t}</strong><p>${st.b}</p></div></div>`).join('')}
        <button class="sc-guide-btn" data-guide="${s.id}">💬 让瓦奇陪我走一遍</button>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.sc-item-head').forEach(h=>h.onclick=()=>{
    const item=h.parentElement, body=item.querySelector('.sc-item-body');
    const wasOpen=item.classList.contains('open');
    list.querySelectorAll('.sc-item').forEach(x=>{x.classList.remove('open');x.querySelector('.sc-item-body').style.display='none';});
    if(!wasOpen){ item.classList.add('open'); body.style.display='block'; }
  });
  list.querySelectorAll('.sc-guide-btn').forEach(b=>b.onclick=()=>this.startGuide(b.dataset.guide));
},
async renderSafetyNews(){
  const f=$('safety-news'); if(!f) return;
  f.innerHTML='<div class="snews-loading">正在加载最新资讯…</div>';
  let items=[];
  try{
    const r=await fetch('/api/news');
    const d=await r.json();
    items=d.items||[];
  }catch(e){}
  if(!items.length){
    f.innerHTML='<div class="snews-empty">暂时加载不到最新资讯，请检查网络后再试</div>';
    return;
  }
  f.innerHTML=items.map(n=>`
    <a class="snews-card" href="${n.url}" target="_blank" rel="noopener">
      <span class="snews-emoji">📰</span>
      <div class="snews-body">
        <span class="snews-text">${n.title}</span>
        <span class="snews-meta">${n.source} · ${n.date}</span>
      </div>
      <span class="snews-arrow">›</span>
    </a>
  `).join('');
},

// ── 维权引导（在聊天流里一步一步带）──────────────
startGuide(sceneId){
  const s=this.scenarios.find(x=>x.id===sceneId);
  if(!s) return;
  this.closeMask();
  this.switchTab('yaya');
  this._guide={id:sceneId, step:-1};
  this.addMsg('yy', s.emoji+' 别怕，我陪你。先让你知道，你不是一个人：');
  setTimeout(()=>this.addMsg('yy','📌 真实案例：'+s.case), 500);
  setTimeout(()=>this._nextGuideStep(), 1100);
},
_nextGuideStep(){
  const g=this._guide; if(!g) return;
  const s=this.scenarios.find(x=>x.id===g.id); if(!s){ this._guide=null; return; }
  g.step++;
  if(g.step>=s.steps.length){ this._finishGuide(); return; }
  const st=s.steps[g.step];
  const segs=this._splitSentences(st.b);
  this.addMsg('yy', (g.step+1)+'、'+st.t);
  let delay=400;
  segs.forEach(seg=>{ setTimeout(()=>this.addMsg('yy', seg), delay); delay+=450; });
  const last=g.step===s.steps.length-1;
  const chips=last?['谢谢你瓦奇','我还想聊聊','我记住了']:['我明白了','我做到了','做不到怎么办'];
  setTimeout(()=>this._showGuideChips(chips), delay+400);
},
_handleGuideInput(text,ct){
  this.addMsg('me',text,ct);
  this._clearGuideChips();
  this._guideReply(text);
},
_guideReply(text){
  const g=this._guide; if(!g) return;
  const s=this.scenarios.find(x=>x.id===g.id); if(!s){ this._guide=null; return; }
  if(/做不到|怎么办|困难|不会|害怕|太难|不敢/.test(text)){
    this.addMsg('yy','没关系，做不做得到都不代表你软弱。我们先做能做的，剩下的我陪你。');
  } else if(/好了|明白|知道|嗯|记住|谢谢|聊聊|说/.test(text)){
    this.addMsg('yy','嗯，我在听。');
  } else {
    this.addMsg('yy','我懂。先缓一缓，我们继续。');
  }
  setTimeout(()=>this._nextGuideStep(), 700);
},
_showGuideChips(chips){
  const ct=$('drawer-msgs'); if(!ct) return;
  const e=document.createElement('div'); e.className='guide-chips';
  chips.forEach(c=>{
    const b=document.createElement('button'); b.className='guide-chip'; b.textContent=c;
    b.onclick=()=>{ this._clearGuideChips(); this._guideReply(c); };
    e.appendChild(b);
  });
  ct.appendChild(e); ct.scrollTop=ct.scrollHeight;
},
_clearGuideChips(){ $$('#drawer-msgs .guide-chips').forEach(e=>e.remove()); },
_splitSentences(t){ return (t||'').split(/[。！？；→]/).map(s=>s.trim()).filter(Boolean); },
_finishGuide(){
  this._guide=null;
  this.addMsg('yy','💛 你不需要一个人扛。这些法律和热线，随时在你身后。');
  this.addMsg('yy','心里难受就说给我听，我一直在。');
},

replyIdx:0,
mockReply(text){
  const t=(text||'').toLowerCase();
  if(/你叫|名字|你是谁|你是什么|介绍.*自己/.test(t))return '我叫瓦奇～是一只 AI 毛绒挂件，挂在主人的包上。你呢？';
  if(/你好|hi|hello|嗨|哈喽/.test(t))return '嗨～今天过得怎么样呀？';
  if(/天气|下雨|冷不冷|热不热|温度/.test(t))return '深圳今天31度，大晴天。出门记得防晒哦～';
  if(/例假|月经|姨妈|经期|肚子疼/.test(t)){const p=Store.data.period;const last=p.lastStart?this.fmtDate(p.lastStart):'上次';return '主人是不是不舒服？我帮你记着呢（上次是'+last+'来的）。要不要喝点热水？';}
  if(/几点|日期|今天.*几号|星期几/.test(t)){const n=new Date();return '现在是'+n.getHours()+'点'+n.getMinutes()+'分，'+n.getFullYear()+'年'+(n.getMonth()+1)+'月'+n.getDate()+'日～';}
  if(/累|困|加班|忙|压力|疲惫/.test(t))return '听起来你今天好累。先去洗个热水澡吧？瓦奇在浴室门口等你。';
  if(/开心|哈哈|好耶|太棒|成功|过了/.test(t))return '哇太好了！我也替你开心～这个好消息我要记进日记里！';
  if(/难过|哭|伤心|委屈|分手|不开心/.test(t))return '没关系，难过的时候说出来会好一点。我就在这儿，不走。';
  if(/怕|跟着|有人跟|危险|救|安全|跟踪|走夜路/.test(t))return '你要不要先走到人多的地方？需要我帮你打电话给紧急联系人吗？';
  if(/无聊|不知道.*说什么|没话说/.test(t))return '那瓦奇给你讲个冷笑话？——为什么企鹅肚子是白的？……因为它手太短只能洗到肚子！';
  if(/日记|记下来|帮我记|写下来/.test(t))return '好嘞，我帮你写进今天的日记了！晚上可以翻手账页看看哦～';
  if(/爱你|喜欢你|谢谢|好人/.test(t))return '嘿嘿，瓦奇也喜欢你呀～虽然我只是一只毛绒玩具，但我会一直陪着你的。';
  const def=['嗯，我记着了。要不要写进日记里？','好呀，还有什么想跟我说的？','有我在呢，想说什么都可以～','你今天看起来不错诶，发生了什么好事吗？','主人说话的时候，我觉得时间过得特别快～','那你有没有按时吃饭？','我喜欢听你说话。你声音好好听。'];
  return def[Math.floor(Math.random()*def.length)];
},

// ── 记忆提取（瓦奇真的会"记住"）──────────────────
extractMemory(text){
  const d=Store.data; let added=false;
  const push=(type,content)=>{ if(d.memories.some(m=>m.type===type&&m.text===content))return; d.memories.push({type,text:content,time:Date.now()}); added=true; };
  let m;
  if(m=text.match(/我(?:叫|的名字?是)[：: ]*([一-龥A-Za-z]{1,8})/))push('名字',m[1]);
  if(m=text.match(/我喜欢([一-龥A-Za-z0-9，、 ]{1,20})/))push('喜欢',m[1]);
  if(m=text.match(/我(?:讨厌|不喜欢)([一-龥A-Za-z0-9，、 ]{1,20})/))push('不喜欢',m[1]);
  if(m=text.match(/(?:经期|例假|月经|姨妈)[是在]?(\d{1,2})号/))push('经期',m[1]+'号');
  if(m=text.match(/生日[是在]?(\d{1,2})月(\d{1,2})/))push('生日',m[1]+'月'+m[2]+'日');
  if(added){ Store.save(); this.renderMemoryPage(); }
},

// ── 能量系统 ─────────────────────────────────────
award(n,label,capKey){
  const d=Store.data; const t=this.todayStr();
  if(d.energy.daily.date!==t){ d.energy.daily={date:t, chat:0, touch:0, feed:0}; }
  if(capKey && d.energy.daily[capKey]>=this.energyCaps[capKey]) return false;
  if(capKey) d.energy.daily[capKey]++;
  d.energy.balance+=n; d.energy.lifetime+=n;
  Store.save(); this.renderEnergy(); this.renderGrowth();
  this.toast('+'+n+'⚡'+(label?' '+label:''));
  return true;
},
signIn(){
  const d=Store.data; const t=this.todayStr();
  if(d.energy.lastSignin===t){ this.toast('今天已经签过啦，明天再来～'); return; }
  let streak=1;
  if(d.energy.lastSignin===this.addDays(t,-1)) streak=d.energy.streak+1;
  d.energy.lastSignin=t; d.energy.streak=streak;
  const bonus=20+Math.min(streak-1,7)*2;
  Store.save(); this.renderEnergy();
  this.award(bonus, streak>1?('签到·连续'+streak+'天'):'签到');
  this.showBubble(streak>1?('连续签到'+streak+'天啦，好棒！'):'签到成功，今天也要开开心心～');
},
renderEnergy(){
  const d=Store.data; const t=this.todayStr();
  const bal=$('energy-bal'); if(bal) bal.textContent=d.energy.balance;
  const lt=$('energy-lifetime'); if(lt) lt.textContent=d.energy.lifetime;
  const se=$('set-energy'); if(se) se.textContent=d.energy.balance;
  const sb=$('btn-signin');
  if(sb){
    if(d.energy.lastSignin===t){ sb.textContent='已签到 ✓'; sb.classList.add('done'); sb.disabled=true; }
    else { sb.textContent='签到 +20'; sb.classList.remove('done'); sb.disabled=false; }
  }
},
renderGrowth(){
  const d=Store.data; const L=d.energy.lifetime;
  const st=this.growthStages; let cur=st[0],nxt=st[1]||null;
  for(let i=0;i<st.length;i++){ if(L>=st[i].min){ cur=st[i]; nxt=st[i+1]||null; } }
  const set=(id,v)=>{const el=$(id); if(el) el.textContent=v};
  set('grow-stage-icon',cur.emoji); set('grow-stage-name',cur.name);
  const fill=$('grow-fill');
  if(fill){ if(nxt){ fill.style.width=Math.min(100,Math.round((L-cur.min)/(nxt.min-cur.min)*100))+'%'; } else { fill.style.width='100%'; } }
  set('grow-val', nxt? (L+' / '+nxt.min) : (L+' ⚡'));
  set('grow-hint','签到、聊天、摸摸、写日记都能攒能量 ⚡ 攒够可兑换装扮');
},

// ── 饱食度 / 投喂系统 ─────────────────────────────
decaySatiety(){
  const s=Store.data.satiety; const now=Date.now();
  if(!s.lastUpdate) s.lastUpdate=now;
  const hrs=(now-s.lastUpdate)/3600e3;
  if(hrs>0) s.value=Math.max(0, s.value - hrs*3);
  s.lastUpdate=now;
  return s.value;
},
feedFood(food){
  this.decaySatiety();
  const s=Store.data.satiety;
  if(s.value>=95){ this.toast('瓦奇吃不下啦，先消化一会儿吧～'); return false; }
  s.value=Math.min(100, s.value + food.satiety);
  s.lastUpdate=Date.now();
  Store.save();
  this.award(food.energy, '喂食', 'feed');
  this.renderSatiety();
  return true;
},
renderSatiety(){
  const v=this.decaySatiety(); const pct=Math.round(v);
  const fill=$('satiety-fill'); if(fill) fill.style.width=pct+'%';
  const val=$('satiety-val'); if(val) val.textContent=pct+' / 100';
  const ico=$('satiety-ico'); if(ico) ico.textContent=v>70?'😋':(v>=30?'🙂':'😫');
  const hint=$('satiety-hint'); if(hint) hint.textContent=v>=70?'吃得好饱，瓦奇心情超好 😋':(v>=30?'肚子有点饿了，喂点好吃的吧 🍎':'好饿好饿，主人快来投喂我 😫');
  const arFill=$('ar-satiety-fill'); if(arFill) arFill.style.width=pct+'%';
  const arVal=$('ar-satiety-val'); if(arVal) arVal.textContent=pct;
},

// ── 饭盒（食物背包）────────────────────────────
initFoodbox(){
  if(!Store.data.foodbox) Store.data.foodbox={items:[], equipped:[]};
  const box=Store.data.foodbox;
  if(!Array.isArray(box.items)) box.items=[];
  if(!Array.isArray(box.equipped)) box.equipped=[];
  if(!box.items.length){
    box.items=this.foods.map(f=>({id:f.id, kind:'emoji', emoji:f.emoji, name:f.name, img:null, glb:null, satiety:f.satiety, energy:f.energy}));
    box.equipped=box.items.slice(0,5).map(f=>f.id);
    Store.save();
  }
},
getFood(id){ return (Store.data.foodbox&&Store.data.foodbox.items||[]).find(f=>f.id===id); },
foodboxItems(){ return (Store.data.foodbox&&Store.data.foodbox.items)||[]; },
foodboxEquipped(){ return (Store.data.foodbox&&Store.data.foodbox.equipped)||[]; },
addFood(item){
  if(!Store.data.foodbox) this.initFoodbox();
  const box=Store.data.foodbox;
  box.items.push(item);
  if(box.equipped.length<5) box.equipped.push(item.id);
  Store.save();
  return item;
},
equipFood(id){
  const box=Store.data.foodbox; if(!box) return;
  if(box.equipped.includes(id)){ box.equipped=box.equipped.filter(x=>x!==id); }
  else{
    if(box.equipped.length>=5){ this.toast('快捷栏满啦，先拿下一个吧 🍱'); return; }
    box.equipped.push(id);
  }
  Store.save(); this.renderFoodbox(); this.renderHotbar();
},
renderFoodbox(){
  const box=Store.data.foodbox; const g=$('ar-foodbox-grid'); if(!g||!box) return;
  if(!box.items.length){ g.innerHTML='<div class="ar-foodbox-empty">饭盒还空空的，点下方「添加食物」吧 🍽️</div>'; return; }
  g.innerHTML=box.items.map(f=>{
    const eq=box.equipped.includes(f.id);
    const icon=f.kind==='emoji'?`<span class="fb-emoji">${f.emoji}</span>`:(f.img?`<img class="fb-img" src="${f.img}">`:`<span class="fb-emoji">🍽️</span>`);
    return `<div class="ar-foodbox-item ${eq?'active':''}" onclick="App.equipFood('${f.id}')">${icon}<span class="fb-name">${f.name}</span>${eq?'<span class="fb-check">✓</span>':''}</div>`;
  }).join('');
},
renderHotbar(){
  const bar=$('ar-hotbar'); if(!bar) return;
  const box=Store.data.foodbox; const eq=box?box.equipped:[];
  let slots='';
  for(let i=0;i<5;i++){
    const f=eq[i]?this.getFood(eq[i]):null;
    if(f){
      const icon=f.kind==='emoji'?`<span class="ar-slot-emoji">${f.emoji}</span>`:(f.img?`<img class="ar-slot-img" src="${f.img}">`:`<span class="ar-slot-emoji">🍽️</span>`);
      slots+=`<button class="ar-slot" onclick="arEatFood('${f.id}')">${icon}</button>`;
    }else{
      slots+=`<button class="ar-slot empty"></button>`;
    }
  }
  slots+=`<button class="ar-slot ar-box" onclick="arOpenFoodbox()"><span class="ar-slot-emoji">🍱</span></button>`;
  bar.innerHTML=slots;
},
async uploadFoodPhoto(file){
  const dataUrl=await this.compressImage(file);
  const n=(Store.data.foodbox&&Store.data.foodbox.items.length||0)+1;
  const item={id:'up_'+Date.now(), kind:'photo', emoji:'', name:'美食 '+n, img:dataUrl, glb:null, satiety:10, energy:1};
  this.addFood(item); this.renderFoodbox(); this.renderHotbar();
  this.toast('美食已加入饭盒 🍱');
  return item;
},
async uploadFood3D(file){
  const dataUrl=await this.compressImage(file);
  this.toast('正在生成 3D 食物，稍等一下… 🧊');
  try{
    const r=await fetch('/api/food3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:dataUrl})});
    const d=await r.json();
    if(d && d.glb){
      const n=(Store.data.foodbox&&Store.data.foodbox.items.length||0)+1;
      const item={id:'up_'+Date.now(), kind:'mesh', emoji:'', name:d.name||('3D 美食 '+n), img:d.preview||dataUrl, glb:d.glb, satiety:15, energy:2};
      this.addFood(item); this.renderFoodbox(); this.renderHotbar();
      this.toast('3D 食物已加入饭盒 🧊');
      return item;
    }
    this.toast((d&&d.msg)||'3D 生成暂不可用，先用贴片吧～');
    return null;
  }catch(e){
    this.toast('3D 生成失败，先用贴片吧～');
    return null;
  }
},
// 扫描真实食物：抽帧 dataURL → /api/foodscan → {food:{name,emoji,satiety,energy}} 或 {food:null,msg}
async scanFood(image){
  try{
    const url=this.api.url.replace(/\/api\/chat$/,'/api/foodscan');
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image})});
    if(!r.ok) throw Error();
    return await r.json();
  }catch(e){ return {food:null, msg:'扫描失败，再试一次～'}; }
},
// 扫描识别出的食物自动入饭盒（photo 类贴片食物），返回饭盒 item
addScannedFood(food, img){
  if(!Store.data.foodbox) this.initFoodbox();
  const box=Store.data.foodbox;
  const item={id:'scan_'+Date.now(), kind:'photo', emoji:food.emoji, name:food.name, img:img, glb:null, satiety:food.satiety, energy:food.energy};
  box.items.push(item);
  if(box.equipped.length<5) box.equipped.push(item.id);
  Store.save();
  return item;
},

// ── 装扮系统 ─────────────────────────────────────
renderWardrobe(){
  const d=Store.data; const own=d.outfits.owned, eq=d.outfits.equipped;
  const cat=this.outfits, cur=cat.find(o=>o.id===eq);
  $('owned-skins').innerHTML=cat.filter(o=>own.includes(o.id)).map(o=>
    `<div class="sk-card ${o.id===eq?'active':''}" onclick="App.equip('${o.id}')"><span>${o.emoji}</span><small>${o.name}</small></div>`).join('');
  $('energy-shop').innerHTML=cat.filter(o=>o.kind==='energy'&&!own.includes(o.id)).map(o=>
    `<div class="sk-card shop" onclick="App.buyEnergy('${o.id}')"><span>${o.emoji}</span><small>${o.cost}⚡</small></div>`).join('')||'<span style="font-size:12px;color:var(--ink2)">能量装扮都集齐啦～</span>';
  $('physical-shop').innerHTML=cat.filter(o=>o.kind==='physical'&&!own.includes(o.id)).map(o=>
    `<div class="sk-card shop" onclick="App.buyPhysical('${o.id}')"><span>${o.emoji}</span><small>¥${o.price}</small></div>`).join('')||'<span style="font-size:12px;color:var(--ink2)">实体款都解锁啦～</span>';
  const we=$('ward-equipped'); if(we&&cur) we.textContent='当前穿戴：'+cur.emoji+' '+cur.name;
},
equip(id){
  Store.data.outfits.equipped=id; Store.save(); this.renderWardrobe();
  const o=this.outfits.find(x=>x.id===id);
  this.showBubble('换上新衣服啦！'+o.emoji);
},
buyEnergy(id){
  const o=this.outfits.find(x=>x.id===id); if(!o) return;
  if(Store.data.energy.balance<o.cost){ this.toast('能量不够哦，多陪瓦奇攒一点吧 ⚡'); return; }
  Store.data.energy.balance-=o.cost; Store.data.outfits.owned.push(id); Store.data.outfits.equipped=id;
  Store.save(); this.renderWardrobe(); this.renderEnergy();
  this.toast('已兑换 '+o.name+' '+o.emoji);
  this.showBubble('好喜欢这件！谢谢主人～');
},
buyPhysical(id){
  this._redeemTarget=id;
  const o=this.outfits.find(x=>x.id===id);
  const t=$('redeem-title'); if(t) t.textContent='解锁 · '+o.name+' '+o.emoji;
  const i=$('redeem-input'); if(i) i.value='';
  $('sheet-redeem').classList.add('on'); $('mask').classList.add('on');
},
redeemSubmit(){
  const code=($('redeem-input').value||'').trim();
  if(!code){ this.toast('请输入兑换码'); return; }
  const id=this._redeemTarget; this._redeemTarget=null;
  const o=this.outfits.find(x=>x.id===id);
  if(!Store.data.outfits.owned.includes(id)) Store.data.outfits.owned.push(id);
  Store.data.outfits.equipped=id; Store.save();
  this.closeMask(); this.renderWardrobe();
  this.toast('解锁成功：'+o.name+'（虚实联动）');
  this.showBubble('实体娃衣到货，线上也换上同款啦！');
},

// ── Toast ────────────────────────────────────────
toast(msg){
  const t=$('toast'); if(!t) return;
  t.textContent=msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(this._tT); this._tT=setTimeout(()=>t.classList.remove('show'),2200);
},

// ── Init ────────────────────────────────────────────
init(){
  Store.load();
  WakiDevice.load();
  this.introCurtain();
},

// ── Intro: 帘子 → 飞燕 → 主页 ─────────────────
introCurtain(){
  const curtains=document.getElementById('intro-curtains');
  const hint=document.getElementById('intro-hint');
  const title=document.getElementById('intro-title');
  const fade=document.getElementById('intro-fade');
  const screen=document.getElementById('intro-screen');
  if(!curtains)return this._mainInit();
  if(typeof window.p5!=='function'){
    screen.style.display='none';
    this._mainInit();
    return;
  }

  const phone=document.getElementById('phone');
  const W=phone?phone.offsetWidth:430,H=phone?phone.offsetHeight:932;

  const swallowSketch=(p)=>{
    const birds=[];
    for(let i=0;i<10;i++)birds.push({x:W+80+p.random(0,200),y:80+p.random(0,300),s:0.5+p.random(0,0.6),sp:1.5+p.random(0,2.5),ph:p.random(0,6.28),yo:0});
    p.setup=()=>{const c=p.createCanvas(W,H);c.parent('intro-screen');c.style('pointer-events','none');c.style('z-index','3');c.style('position','absolute');c.style('top','0');c.style('left','0');p.clear()};
    p.draw=()=>{p.clear();birds.forEach(b=>{b.x-=b.sp;b.yo=p.sin(b.ph+b.x*0.02)*20;if(b.x<-80){b.x=W+80;b.y=80+p.random(0,300)}const y=b.y+b.yo,s=b.s;p.push();p.translate(b.x,y);p.scale(s,s);p.fill('#2a1a35');p.noStroke();p.beginShape();p.vertex(-6,-16);p.vertex(-2,-20);p.vertex(2,-20);p.vertex(6,-16);p.vertex(4,-8);p.vertex(8,-4);p.vertex(0,-2);p.vertex(-8,-4);p.vertex(-4,-8);p.endShape(p.CLOSE);const wa=p.sin(Date.now()*0.014+b.ph)*0.55;p.push();p.translate(-5,-8);p.rotate(-0.5+wa);p.beginShape();p.vertex(0,0);p.quadraticVertex(-22,-12,-26,4);p.quadraticVertex(-14,0,0,0);p.endShape(p.CLOSE);p.pop();p.push();p.translate(5,-8);p.rotate(0.5-wa);p.beginShape();p.vertex(0,0);p.quadraticVertex(22,-12,26,4);p.quadraticVertex(14,0,0,0);p.endShape(p.CLOSE);p.pop();p.beginShape();p.vertex(0,0);p.vertex(-9,28);p.vertex(-2,14);p.vertex(2,14);p.vertex(9,28);p.endShape(p.CLOSE);p.pop()})};
  };
  let swallowP5=null;

  const curtainP5=new p5((p)=>{
    const LINE=14,COL='#E8577C',ALPHA=220,LEN=780,DR_MIN=6,DR_MAX=14,DS_MIN=0.22,DS_MAX=0.48,GRV=0.16,REP=90;
    let bodies=[],drops=[],lines=[],dropImgs=[];
    for(let i=1;i<=12;i++){const img=p.loadImage('https://cdn.jsdelivr.net/gh/xxoogreymon-prog/image-resources@main/icons/rain_drops/drop'+i+'.png',()=>{},()=>{});dropImgs.push(img)}
    function pickImg(){const v=dropImgs.filter(i=>i&&i.width>0);return v.length?v[Math.floor(p.random(v.length))]:null}
    p.setup=()=>{
      const c=p.createCanvas(W,H);c.parent('intro-screen');c.style('pointer-events','none');c.style('z-index','1');c.style('position','absolute');c.style('top','0');c.style('left','0');
      p.frameRate(30);
      const sp=(W-60)/(LINE-1);for(let i=0;i<LINE;i++)lines.push({x0:30+i*sp,y1:-10});
      for(let li=0;li<lines.length;li++){const ln=lines[li],top=ln.y1+p.random(30,80),end=ln.y1+LEN;const n=Math.max(1,Math.floor(p.random(DR_MIN,DR_MAX+1)));for(let i=0;i<n;i++){const t=i/(n-1),yc=p.lerp(top,end,t)+p.random(-5,5);drops.push({y0:p.constrain(yc,top,end-2),r:p.random(DS_MIN,DS_MAX)*16,li,attached:true,img:pickImg()})}}
      const nSub=8;
      for(let li=0;li<lines.length;li++){const base=lines[li],bd=drops.filter(d=>d.li===li).sort((a,b)=>a.y0-b.y0);if(!bd.length)continue;const rb={pts:[],segs:[],li,dropIdxs:[],restY:[]};rb.pts.push({pos:p.createVector(base.x0,base.y1),old:p.createVector(base.x0,base.y1),snap:true});rb.restY.push(0);const bY=[0];bd.forEach(d=>bY.push(d.y0-base.y1));for(let j=0;j<bd.length;j++){const spn=bY[j+1]-bY[j];for(let s=0;s<nSub;s++){const t=(s+1)/nSub,yOff=p.lerp(bY[j],bY[j+1],t);rb.pts.push({pos:p.createVector(base.x0,base.y1+yOff),old:p.createVector(base.x0,base.y1+yOff),snap:false});rb.restY.push(yOff);if(s===nSub-1)rb.dropIdxs.push(rb.pts.length-1);rb.segs.push({a:rb.pts.length-2,b:rb.pts.length-1,rl:spn/nSub})}}bodies.push(rb)}
    };
    p.draw=()=>{try{p.clear();bodies.forEach(rb=>{rb.pts.forEach(pt=>{if(!pt.snap){pt.old.add(0,GRV);const d=p.dist(p.mouseX,p.mouseY,pt.pos.x,pt.pos.y);if(d<REP&&d>1e-6){const rv=pt.pos.copy().sub(p.createVector(p.mouseX,p.mouseY));if(rv.magSq()>1e-6)pt.old.add(rv.normalize())}}})});bodies.forEach(rb=>rb.segs.forEach(s=>{const a=rb.pts[s.a],b=rb.pts[s.b];if(!a||!b||a.snap&&b.snap)return;const cl=a.pos.dist(b.pos);if(cl<1e-8)return;const diff=(s.rl-cl)/cl/5,dv=b.pos.copy().sub(a.pos).mult(diff);if(!a.snap)a.pos.sub(dv);if(!b.snap)b.pos.add(dv)}));const cc=p.color(COL);bodies.forEach(rb=>{for(let i=0;i<rb.pts.length-1;i++){p.stroke(p.red(cc),p.green(cc),p.blue(cc),ALPHA);p.strokeWeight(1);p.strokeCap(p.ROUND);p.line(rb.pts[i].pos.x,rb.pts[i].pos.y,rb.pts[i+1].pos.x,rb.pts[i+1].pos.y)}});bodies.forEach(rb=>{rb.dropIdxs.forEach((di,idx)=>{const d=drops.filter(dd=>dd.li===rb.li)[idx];if(!d||!d.attached)return;const pt=rb.pts[di];if(d.img&&d.img.width>0)p.image(d.img,pt.pos.x-d.r,p.pos.y-d.r,d.r*2,d.r*2);else{p.fill(p.red(cc)+40,p.green(cc)+20,p.blue(cc)+30,200);p.noStroke();p.ellipse(pt.pos.x,pt.pos.y,d.r,d.r)}})});}catch(e){} };
  });

  const open=()=>{
    curtains.classList.add('open');if(hint)hint.classList.add('hide');
    setTimeout(()=>{curtainP5.remove();swallowP5=new p5(swallowSketch);setTimeout(()=>title.classList.add('show'),400)},600);
    setTimeout(()=>fade.classList.add('hide'),2800);
    setTimeout(()=>{if(swallowP5)swallowP5.remove();screen.style.display='none';this._mainInit()},3600);
  };
  curtains.addEventListener('click',open);
  curtains.addEventListener('touchstart',open,{once:true});
},

_mainInit(){
  this.bindTabs();this.bindNavigation();this.bindSheets();
  this.bindChatInput();this.bindWakiInteraction();
  this.renderScenarios();this.renderSafetyNews();this.bindNurtureSubtabs();this.bindGameLaunch();
  this.bindHandbookSubtabs();this.bindHealthEditors();this.bindDiary();
  this.bindMediaUpload();
  this.renderCalendar();this.renderTodayHero();this.renderNewsFeed();
  this.initFoodbox();
  this.renderEnergy();this.renderGrowth();this.renderSatiety();this.renderWardrobe();
  this.renderWeather();this.renderHealth();
  this.renderTimeline();this.renderSparkline();
  this.loadConversationDiary();   // 异步拉服务器里的对话日记，回来再刷时间轴
  this.restoreChat();this.renderMemoryPage();
  this.updateClock();setInterval(()=>this.updateClock(),30000);
  this.bindDeviceDemo();this.renderDeviceStatus();
  if(!Store.data.chatHistory.length && !Store.data.flags.greeted)this.showLoadingThenGreet();
},

bindDeviceDemo(){
  const online=$('demo-online'),battery=$('demo-battery'),network=$('demo-network'),reset=$('demo-reset-device');
  if(online) online.onchange=()=>{WakiDevice.update({online:online.checked});this.renderDeviceStatus()};
  if(battery) battery.oninput=()=>{WakiDevice.update({battery:Number(battery.value)});this.renderDeviceStatus()};
  if(network) network.onchange=()=>{WakiDevice.update({network:network.value,online:network.value!=='离线'});this.renderDeviceStatus()};
  if(reset) reset.onclick=()=>{WakiDevice.reset();this.renderDeviceStatus();this.toast('已恢复默认演示状态')};
},
async renderDeviceStatus(){
  const d=await WakiDevice.getStatus();
  const online=d.online&&d.network!=='离线';
  const status=$('sb-status');
  if(status) status.innerHTML=`<span class="dot ${online?'online':'offline'}"></span> 瓦奇${online?'在线':'离线'}`;
  const connection=$('device-connection');
  if(connection){connection.textContent=online?'● 已连接':'● 未连接';connection.classList.toggle('ok',online);connection.classList.toggle('off',!online)}
  const battery=$('device-battery');if(battery)battery.textContent=d.battery+'%';
  const network=$('device-network');if(network)network.textContent=d.network;
  const onlineInput=$('demo-online');if(onlineInput)onlineInput.checked=online;
  const batteryInput=$('demo-battery');if(batteryInput)batteryInput.value=d.battery;
  const batteryValue=$('demo-battery-value');if(batteryValue)batteryValue.textContent=d.battery+'%';
  const networkInput=$('demo-network');if(networkInput)networkInput.value=d.network;
},

updateClock(){
  const el=$('sb-time'); if(!el) return;
  const n=new Date();
  el.textContent=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
},

// ── Waki Video Mood ────────────────────────────────
setWakiMood(mood){
  this.state.yayaMood=mood;
  const v=$('yaya-vid');if(!v)return;
  const map={bored:'/assets/videos/yaya-bored.mp4',tickled:'/assets/videos/yaya-tickle.mp4',headpat:'/assets/videos/yaya-headpat.mp4'};
  if(map[mood]){
    v.loop=(mood==='bored');
    if(!v.src.includes(map[mood])){
      v.src=map[mood];
      v.load();setTimeout(()=>v.play().catch(()=>{}),100);
    }else if(v.paused)v.play().catch(()=>{});
  }
  if(mood==='headpat')this._mrT=setTimeout(()=>{if(this.state.yayaMood==='headpat')this.setWakiMood('bored');$('scene-mood').textContent=this.getSceneText()},5000);
  if(mood==='tickled')this._mrT2=setTimeout(()=>{if(this.state.yayaMood==='tickled')this.setWakiMood('bored');$('scene-mood').textContent=this.getSceneText()},4500);
  const txt={bored:'好无聊呀…你在干嘛呢',tickled:'哈哈哈哈别挠了！',headpat:'嗯…好舒服…'};
  if(txt[mood])$('scene-mood').textContent=txt[mood];
},
getSceneText(){const h=this.state.currentHour;const s=this.timeSlots.find(s=>h>=s.from&&h<s.to);return s?s.text:'今天有点困困的'},

showBubble(text){
  const b=$('speech-bub'),t=$('speech-txt');if(!b||!t)return;
  b.classList.remove('show');void b.offsetWidth;
  t.textContent=text.length>30?text.slice(0,28)+'…':text;
  b.classList.add('show');clearTimeout(this._bT);
  this._bT=setTimeout(()=>b.classList.remove('show'),4200);
},

// ── Waki Interaction ───────────────────────────────
bindWakiInteraction(){
  const wrap=$('yaya-wrap');if(!wrap)return;
  let tapTimer=null,pressTimer=null,tapCount=0;
  const ok=()=>!this.state.isRecording&&!this.state.page;
  wrap.addEventListener('click',e=>{
    if(!ok())return;
    tapCount++;
    if(tapCount===1){tapTimer=setTimeout(()=>{if(tapCount===1)this.doHeadpat();tapCount=0},300)}
    else if(tapCount===2){clearTimeout(tapTimer);tapCount=0;this.doTickle()}
  });
  const sp=e=>{if(!ok())return;pressTimer=setTimeout(()=>this.doTickle(),600)};
  const ep=()=>clearTimeout(pressTimer);
  wrap.addEventListener('touchstart',sp,{passive:true});wrap.addEventListener('touchend',ep);
  wrap.addEventListener('mousedown',sp);wrap.addEventListener('mouseup',ep);
},
doHeadpat(){this.state.lastActivity=Date.now();this.setWakiMood('headpat');this.showBubble('嗯……');this.award(2,'摸摸','touch')},
doTickle(){this.state.lastActivity=Date.now();this.setWakiMood('tickled');this.showBubble('哈哈哈别挠了！');this.award(2,'互动','touch')},

// ── 场景自动收起（豆包式）──────────────────────────
setSceneSmall(small){
  const tab=$('tab-yaya'); if(tab) tab.classList.toggle('scene-small',small);
},

// ── 图片/视频上传 ────────────────────────────────
bindMediaUpload(){
  const btn=$('btn-upload'); const inp=$('media-input'); if(!btn||!inp) return;
  btn.onclick=()=>inp.click();
  inp.onchange=e=>{ const f=e.target.files[0]; if(f) this.sendMedia(f); inp.value=''; };
},
addMsgMedia(who,media,ct){
  ct=ct||$('drawer-msgs'); if(!ct) return;
  const e=document.createElement('div'); e.className='dbub '+who+' media';
  e.innerHTML=media.type==='image'
    ? '<img class="media-img" src="'+media.src+'">'
    : '<video class="media-vid" src="'+media.src+'" controls playsinline></video>';
  ct.appendChild(e); ct.scrollTop=ct.scrollHeight; return e;
},
compressImage(file){
  return new Promise(res=>{
    const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{ const MAX=720; let w=img.width,h=img.height;
      if(w>MAX){ h=Math.round(h*MAX/w); w=MAX; }
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg',0.72)); };
    img.onerror=()=>{ URL.revokeObjectURL(url); this.readFileAsDataURL(file).then(res); };
    img.src=url;
  });
},
readFileAsDataURL(file){ return new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); }); },
async getAIReplyVision(image){
  if(!this.api.url) return null;
  try{
    const url=this.api.url.replace(/\/api\/chat$/,'/api/vision');
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...this.api.key?{Authorization:'Bearer '+this.api.key}:{}},body:JSON.stringify({image})});
    if(!r.ok)throw Error();
    const d=await r.json();
    return d;  // {reply, feed?}
  }catch(e){}
  return null;
},
describeVisionStats(stats){
  const brightness=Number(stats&&stats.brightness)||0;
  const warmth=Number(stats&&stats.warmth)||0;
  const contrast=Number(stats&&stats.contrast)||0;
  let light='光线适中',reply='这个画面的光线挺舒服，我看得很清楚。';
  if(brightness<62){light='画面光线较暗';reply='这里有点暗，我先陪你看着。换个亮一点的角度会更清楚。'}
  else if(brightness>205){light='画面光线很亮';reply='这里光线很亮，我看见啦。稍微避开强光，细节会更清楚。'}
  const tone=warmth>18?'暖色调':warmth<-18?'冷色调':'自然色调';
  const detail=contrast<24?'细节较柔和':contrast>72?'明暗对比较强':'细节清晰';
  return {reply,observation:light+' · '+tone+' · '+detail,source:'本地画面分析',isDemo:true};
},
async sendMedia(file){
  const ct=$('drawer-msgs'); const isImg=file.type.startsWith('image/');
  if(!isImg && !file.type.startsWith('video/')){ this.toast('只支持图片或视频哦'); return; }
  let src, persist=true;
  if(isImg){ src=await this.compressImage(file); }
  else { src=await this.readFileAsDataURL(file); persist=false; }
  this.addMsgMedia('me',{type:isImg?'image':'video',src},ct);
  if(persist){ Store.data.chatHistory.push({who:'me',type:'image',src,time:Date.now()}); }
  else this.toast('📹 视频已发送（demo 不保存视频）');
  const dots=this.addTyping(ct);
  let res=null;
  if(isImg) res=await this.getAIReplyVision(src);
  let reply=null, feed=null;
  if(res){ reply=res.reply; feed=res.feed; }
  if(!reply){ await new Promise(r=>setTimeout(r,500)); reply=isImg?'瓦奇眼睛还没长好，看不清这张照片…不过我知道一定很好看！':'收到视频啦～下次我们拍一个空间的！'; }
  if(dots)dots.remove();
  this.addMsg('yy',reply,ct); this.showBubble(reply);
  Store.data.chatHistory.push({who:'yy',text:reply,time:Date.now()}); Store.save();
  if(feed){ this.feedItem(feed.emoji,feed.item_name); Store.data.feed.push({emoji:feed.emoji,item:feed.item_name,time:Date.now()}); Store.save(); }
  this.award(5,'聊天','chat');
},
feedItem(emoji,name){
  // 投喂动画：emoji 从屏幕中央飞向瓦奇
  const target=$('yaya-wrap'); const tr=target?target.getBoundingClientRect():null;
  const fx=document.createElement('div');
  fx.className='feed-fx';
  fx.innerHTML='<span class="feed-emoji">'+emoji+'</span><span class="feed-name">'+name+'</span>';
  document.body.appendChild(fx);
  const s=fx.getBoundingClientRect();
  fx.style.left=(window.innerWidth/2 - s.width/2)+'px';
  fx.style.top=(window.innerHeight*0.58)+'px';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(tr){ fx.style.left=(tr.left + tr.width/2 - s.width/2)+'px'; fx.style.top=(tr.top + tr.height*0.32)+'px'; }
    fx.style.transform='scale(.18)';
    fx.style.opacity='0';
  }));
  setTimeout(()=>fx.remove(),1300);
},
saveToTongkuang(dataUrl,feed){
  if(typeof tkSpaces==='undefined'||!tkSpaces) return;
  const d=new Date();
  const sp={id:'tk_'+Date.now(),name:feed?feed.emoji+' '+feed.item_name:'空间'+(tkSpaces.length+1),dataUrl:dataUrl,date:(d.getMonth()+1)+'月'+d.getDate()+'日',feed:feed||null};
  tkSpaces.unshift(sp); tkSave(); tkRenderGallery();
  this.toast('📸 已放进「空间」，去看看吧！');
},

// ── Chat ────────────────────────────────────────────
addMsg(who,text,ct){ct=ct||$('drawer-msgs');if(!ct)return;const e=document.createElement('div');e.className='dbub '+who;e.textContent=text;ct.appendChild(e);ct.scrollTop=ct.scrollHeight;return e},
addTyping(ct){ct=ct||$('drawer-msgs');if(!ct)return null;const e=document.createElement('div');e.className='dbub yy typing';e.innerHTML='<i></i><i></i><i></i>';ct.appendChild(e);ct.scrollTop=ct.scrollHeight;return e},
addCareCard(ct){ct=ct||$('drawer-msgs');if(!ct)return;const e=document.createElement('div');e.className='dbub care';e.innerHTML='<p>🛡 听起来你现在不太安全。我可以帮你联系妈妈，或者直接拨110。</p><button class="care-open">打开守护</button>';e.querySelector('.care-open').onclick=()=>this.openShield();ct.appendChild(e);ct.scrollTop=ct.scrollHeight},
isCare(t){return['害怕','跟着我','有人跟','危险','救救我','报警','偷拍','跟踪','骚扰','走夜路','不安全','尾随'].some(w=>(t||'').includes(w))},

async getAIReply(text){
  if(this.api.url){try{const r=await fetch(this.api.url,{method:'POST',headers:{'Content-Type':'application/json',...this.api.key?{Authorization:'Bearer '+this.api.key}:{}},body:JSON.stringify({messages:[{role:'system',content:this.yayaPrompt},...Store.data.chatHistory.slice(-10).filter(m=>m.text).map(m=>({role:m.who==='me'?'user':'assistant',content:m.text})),{role:'user',content:text}]})});if(!r.ok)throw Error();const d=await r.json();return d.reply||d.content||d.choices?.[0]?.message?.content||d.response||'信号不太好…再说一次？'}catch(e){}}return this.mockReply(text)},

async sendMsg(text,ct){
  text=(text||'').trim();if(!text)return;ct=ct||$('drawer-msgs');
  if(this._guide){ this._handleGuideInput(text,ct); return; }
  this.addMsg('me',text,ct);this.setWakiMood('bored');this.state.lastActivity=Date.now();
  this.extractMemory(text);
  const dots=this.addTyping(ct);
  const reply=await this.getAIReply(text);
  if(dots)dots.remove();this.addMsg('yy',reply,ct);this.showBubble(reply);
  if(this.isCare(text)){await new Promise(r=>setTimeout(r,300));this.addCareCard(ct)}
  Store.data.chatHistory.push({who:'me',text,time:Date.now()},{who:'yy',text:reply,time:Date.now()});
  Store.save();
  this.award(5,'聊天','chat');
},

restoreChat(){
  const h=Store.data.chatHistory; if(!h.length) return;
  const ct=$('drawer-msgs');
  h.forEach(m=>{ if(m.type==='image') this.addMsgMedia('me',{type:'image',src:m.src},ct); else this.addMsg(m.who==='me'?'me':'yy',m.text,ct); });
},

// ── Chat Input ──────────────────────────────────────
bindChatInput(){
  const mic=$('btn-mic');
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let rec=null;
  if(SR){rec=new SR();rec.lang='zh-CN';rec.interimResults=false}

  const startRec=()=>{if(!rec){this.showBubble('按住说话需要微信/Chrome 打开哦');return}try{rec.start()}catch(e){}};
  const stopRec=()=>{if(rec)try{rec.stop()}catch(e){}};

  if(rec){rec.onresult=e=>{const t=e.results[0][0].transcript;if(t.trim())this.sendMsg(t.trim())};rec.onerror=()=>this.setWakiMood('bored');rec.onend=()=>{this.state.isRecording=false;mic.classList.remove('hold');this.setWakiMood('bored')}}

  const hs=e=>{e.preventDefault();if(this.state.isRecording)return;this.state.isRecording=true;mic.classList.add('hold');startRec()};
  const he=()=>{if(!this.state.isRecording)return;stopRec();mic.classList.remove('hold')};

  mic.addEventListener('mousedown',hs);mic.addEventListener('touchstart',hs,{passive:false});
  mic.addEventListener('mouseup',he);mic.addEventListener('mouseleave',he);
  mic.addEventListener('touchend',he);mic.addEventListener('touchcancel',he);

  // 豆包式输入：textarea 随内容长高，聚焦时场景自动收起
  const bind=(ti,bs,mi,ct,collapse)=>{
    if(!ti)return;
    const grow=()=>{ti.style.height='auto';ti.style.height=Math.min(ti.scrollHeight,132)+'px';this.updateInputState(ti,bs,mi)};
    ti.addEventListener('input',grow);
    if(collapse){ti.addEventListener('focus',()=>this.setSceneSmall(true));ti.addEventListener('blur',()=>{if(!ti.value.trim())this.setSceneSmall(false)})}
    ti.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const t=ti.value;if(t.trim()){this.sendMsg(t,ct);ti.value='';grow()}}});
    if(bs)bs.onclick=()=>{const t=ti.value;if(t.trim()){this.sendMsg(t,ct);ti.value='';grow()}};
    grow();
  };
  bind($('text-input'),$('btn-send'),mic,$('drawer-msgs'),true);
  bind($('text-input-fc'),$('btn-send-fc'),$('btn-mic-fc'),$('fullchat-msgs'),false);
},
updateInputState(ti,bs,mi){
  const has=!!(ti&&ti.value.trim());
  if(bs)bs.classList.toggle('show',has);
  if(mi)mi.classList.toggle('hide',has);
},

// ── Navigation ──────────────────────────────────────
bindTabs(){$$('.tab-btn').forEach(b=>{b.onclick=()=>this.switchTab(b.dataset.tab)})},
switchTab(t){this.state.tab=t;$$('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));$$('.tab-view').forEach(v=>v.classList.toggle('active',v.id==='tab-'+t));if(t==='handbook')this.loadConversationDiary()},

bindNavigation(){
  $('btn-gear').onclick=()=>this.openPage('settings');
  $('btn-eyes').onclick=()=>openEyes();
  $('btn-cal-expand').onclick=()=>{this.closePopover();this.openPage('calendar')};
  $$('.pg-back').forEach(b=>b.onclick=()=>this.closePage());
  const mem=$('set-memory'); if(mem) mem.onclick=()=>this.openPage('memory');
  const sw=$('set-wardrobe'); if(sw) sw.onclick=()=>{ this.closePage(); this.switchTab('nurture'); const st=document.querySelector('[data-nurtab="closet"]'); if(st) st.onclick(); };
  const cm=$('btn-clear-memory'); if(cm) cm.onclick=()=>this.clearMemory();
},

openPage(p){if(this.state.page===p)return;this.state.page=p;const el=$('pg-'+p);if(el){el.classList.add('open');if(p==='fullchat')this.syncChat();if(p==='calendar')this.renderNewsFeed();if(p==='memory')this.renderMemoryPage();if(p==='settings')this.renderDeviceStatus()}},
closePage(){if(!this.state.page)return;$('pg-'+this.state.page).classList.remove('open');this.state.page=null},
syncChat(){const s=$('drawer-msgs'),d=$('fullchat-msgs');if(s&&d){d.innerHTML=s.innerHTML;d.scrollTop=d.scrollHeight}},

// ── Sheets ──────────────────────────────────────────
bindSheets(){
  $('btn-shield').onclick=()=>this.openShield();
  $('mask').onclick=()=>this.closeMask();
  $('btn-sheet-close').onclick=()=>this.closeMask();
  this._bindSOS($('btn-call-110'), '110');
  this._bindSOS($('btn-call-em'), '紧急联系人');
  $('btn-confirm-cancel').onclick=()=>{this.closeModal();this.closeMask()};
  $('btn-confirm-go').onclick=()=>this.confirmGuardianAction();
  const rg=$('redeem-go'); if(rg) rg.onclick=()=>this.redeemSubmit();
  const ri=$('redeem-input'); if(ri) ri.addEventListener('keydown',e=>{if(e.key==='Enter')this.redeemSubmit()});
  const br=$('btn-redeem'); if(br) br.onclick=()=>{ const o=this.outfits.find(x=>x.kind==='physical'&&!Store.data.outfits.owned.includes(x.id)); if(o) this.buyPhysical(o.id); else this.toast('实体款都解锁啦'); };
  const es=$('edit-save'); if(es) es.onclick=()=>this.editorSave();
  const ac=$('btn-add-ct'); if(ac) ac.onclick=()=>this.showContactEditor();
  const cs=$('btn-ct-save'); if(cs) cs.onclick=()=>this.saveContact();
  const cc=$('btn-ct-cancel'); if(cc) cc.onclick=()=>this.hideContactEditor();
  this.renderContacts();this.renderGuardEvents();
  // ── 宫格视图切换 ──
  $$('#sheet-shield .sh-cell').forEach(c=>c.onclick=()=>{
    if(c.dataset.view==='talk'){ this.closeMask(); this.sendMsg('我遇到了不好的事情……'); return; }
    this._openShieldView(c.dataset.view);
  });
  $$('#sheet-shield .sh-back').forEach(b=>b.onclick=()=>this._openShieldView(b.dataset.back||'home'));
  // ── 位置守护 ──
  const lt=$('btn-loc-toggle'); if(lt) lt.onclick=()=>this.toggleLocGuard();
  const ls=$('btn-loc-set'); if(ls) ls.onclick=()=>this.setLocSpot();
  $$('#loc-thresholds .loc-chip').forEach(c=>c.onclick=()=>{ Store.data.locThreshold=parseInt(c.dataset.m); Store.save(); this.renderLocGuard(); this.toast('偏离阈值改为 '+c.textContent.trim()); });
  const lf=$('loc-from'), lto=$('loc-to');
  if(lf) lf.onchange=()=>{ Store.data.locDangerFrom=lf.value; Store.save(); };
  if(lto) lto.onchange=()=>{ Store.data.locDangerTo=lto.value; Store.save(); };
  $$('.loc-demo-btn').forEach(b=>b.onclick=()=>this.simulateLocation(b.dataset.locDemo));
  this.renderLocGuard();
  // ── 模拟来电 ──
  const fcRoles=$$('#fc-roles .fc-chip'); if(fcRoles.length){ fcRoles.forEach(c=>c.onclick=()=>{fcRoles.forEach(x=>x.classList.remove('active'));c.classList.add('active');this.fakeCallRole=c.dataset.role; const cust=$('fc-custom'); if(cust) cust.style.display=(c.dataset.role==='custom')?'block':'none';}); }
  const fcMoods=$$('#fc-moods .fc-chip'); if(fcMoods.length){ fcMoods.forEach(c=>c.onclick=()=>{fcMoods.forEach(x=>x.classList.remove('active'));c.classList.add('active');this.fakeCallMood=c.dataset.mood}); }
  const fcs=$('btn-fc-setting'); if(fcs) fcs.onclick=()=>{ const c=$('fc-config'); if(!c) return; const show=c.style.display==='none'; c.style.display=show?'block':'none'; fcs.textContent=show?'✕ 收起':'⚙️ 设置'; };
  const fc5=$('btn-fakecall-5s'); if(fc5) fc5.onclick=()=>this.simulateCall(5);
  const fcn=$('btn-fakecall-now'); if(fcn) fcn.onclick=()=>this.simulateCall(0);
  const cacc=$('btn-call-accept'); if(cacc) cacc.onclick=()=>this.answerCall();
  const cdec=$('btn-call-decline'); if(cdec) cdec.onclick=()=>this.endCall();
},
openShield(){$('sheet-shield').classList.add('on');$('mask').classList.add('on');this._openShieldView('home');this.renderLocGuard();this.renderContacts();this.renderGuardEvents()},
closeMask(){$('sheet-shield').classList.remove('on');$('sheet-redeem').classList.remove('on');$('sheet-diary').classList.remove('on');$('sheet-edit').classList.remove('on');$('mask').classList.remove('on');$('modal-confirm').classList.remove('on');$('pop-calendar').classList.remove('on')},
_openShieldView(v){
  this._shieldView=v||'home';
  $$('#sheet-shield .sh-view').forEach(el=>el.style.display='none');
  const target=$('sh-view-'+this._shieldView);
  if(target) target.style.display='block';
  const sc=document.querySelector('#sheet-shield .sheet-scroll'); if(sc) sc.scrollTop=0;
},
_bindSOS(btn, who){
  if(!btn) return;
  const hint=btn.querySelector('.sos-hint');
  let timer=null, held=false;
  const reset=()=>{ if(timer){ clearInterval(timer); timer=null; } held=false; btn.classList.remove('pressing'); if(hint) hint.textContent='长按 3 秒'; };
  btn.addEventListener('pointerdown', e=>{
    if(held) return; e.preventDefault(); held=true; btn.classList.add('pressing');
    let n=3; if(hint) hint.textContent='松手取消 · '+n;
    timer=setInterval(()=>{ n--; if(n<=0){ reset(); this.confirmCall(who); } else if(hint) hint.textContent='松手取消 · '+n; }, 1000);
  });
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>btn.addEventListener(ev, reset));
},
// ── 位置守护（深夜偏离预警） ───────────────────
toggleLocGuard(){
  Store.data.locGuard=!Store.data.locGuard;
  if(Store.data.locGuard){
    if(!Store.data.locSafeSpot) this.toast('建议先设置常用地点，才能判断偏离');
    this._locAlerted=false;
    this._startLocWatch();
    this.toast('📍 位置守护已开启');
  }else{
    this._stopLocWatch();
    this.toast('位置守护已关闭');
  }
  Store.save(); this.renderLocGuard();
},
setLocSpot(){
  if(!navigator.geolocation){ this.toast('当前浏览器不支持定位'); return; }
  this.toast('正在获取定位…');
  navigator.geolocation.getCurrentPosition(pos=>{
    this._locDemoMode=null;
    Store.data.locSafeSpot={lat:pos.coords.latitude, lng:pos.coords.longitude, label:'家', setAt:Date.now()};
    Store.save(); this._locDist=null; this._locAlerted=false; this.renderLocGuard();
    this.toast('📍 已把当前位置设为常用地点');
    if(Store.data.locGuard) this._startLocWatch();
  }, ()=>{ this.toast('定位失败，请在浏览器允许定位权限'); }, {enableHighAccuracy:true, timeout:12000, maximumAge:30000});
},
renderLocGuard(){
  const spot=$('loc-spot');
  const s=Store.data.locSafeSpot;
  if(spot){
    if(s){
      spot.innerHTML=`<div class="loc-spot-set">🏠 <div style="flex:1;min-width:0"><b>${s.label||'家'}</b><i>${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</i></div><button class="loc-spot-clear" id="btn-loc-clear">清除</button></div>`;
      const cl=$('btn-loc-clear'); if(cl) cl.onclick=()=>{ Store.data.locSafeSpot=null; Store.save(); this._stopLocWatch(); this._locDist=null; this.renderLocGuard(); };
    } else {
      spot.innerHTML='<div class="loc-spot-empty">还没设置常用地点</div>';
    }
  }
  const tg=$('btn-loc-toggle'); if(tg) tg.classList.toggle('on', !!Store.data.locGuard);
  const cur=String(Store.data.locThreshold||3000);
  $$('#loc-thresholds .loc-chip').forEach(c=>c.classList.toggle('active', c.dataset.m===cur));
  const f=$('loc-from'), t=$('loc-to');
  if(f) f.value=Store.data.locDangerFrom;
  if(t) t.value=Store.data.locDangerTo;
  $$('.loc-demo-btn').forEach(b=>b.classList.toggle('active',b.dataset.locDemo===this._locDemoMode));
  this.renderLocStatus();
},
renderLocStatus(){
  const st=$('loc-status'); if(!st) return;
  if(!Store.data.locGuard){ st.innerHTML=''; return; }
  if(!Store.data.locSafeSpot){ st.innerHTML='<div class="loc-status-warn">⚠️ 还没设置常用地点，无法判断偏离</div>'; return; }
  if(this._locDist==null){ st.innerHTML='<div class="loc-status-idle">📍 正在获取定位…</div>'; return; }
  const km=(this._locDist/1000).toFixed(1);
  const inDanger=this._locDemoMode==='danger'||this._isDangerTime();
  if(this._locDist>Store.data.locThreshold && inDanger){
    const contacts=Store.data.contacts||[];
    const verified=contacts.some(c=>c.status==='verified');
    const event=this._locAlertEventId
      ? (Store.data.guardianEvents||[]).find(e=>e.id===this._locAlertEventId)
      : null;
    let notice='请先添加并验证紧急联系人';
    if(contacts.length&&!verified) notice='请先完成联系人测试验证';
    if(event&&event.status==='发送中') notice='正在发送位置';
    if(event&&event.status==='模拟送达') notice='模拟通知已送达';
    st.innerHTML=`<div class="loc-status-danger">⚠️ 距常用地点 ${km} 公里，已超阈值 · ${notice}</div>`;
  } else {
    st.innerHTML=`<div class="loc-status-safe">✅ 距常用地点 ${km} 公里 · ${inDanger?'深夜时段，注意安全':'当前非危险时段'}</div>`;
  }
},
simulateLocation(mode){
  if(mode!=='safe'&&mode!=='danger') return;
  this._stopLocWatch();
  this._locDemoMode=mode;
  if(!Store.data.locSafeSpot){
    Store.data.locSafeSpot={lat:31.2304,lng:121.4737,label:'演示常用地点',setAt:Date.now(),demo:true};
  }
  Store.data.locGuard=true;
  this._locDist=mode==='safe'?280:Number(Store.data.locThreshold||3000)+2200;
  this._locAlerted=false;
  this._locAlertPending=false;
  this._locAlertEventId=null;
  Store.save();
  this._checkLocAlert();
  this.renderLocGuard();
  this.toast(mode==='safe'?'已切换到安全范围路线':'已模拟深夜偏离，正在检查守护通知');
},
_startLocWatch(){
  this._stopLocWatch();
  if(!navigator.geolocation){ this.toast('当前浏览器不支持定位'); return; }
  this._locDemoMode=null;
  this._locAlerted=false;
  this._locAlertPending=false;
  this._locAlertEventId=null;
  const onPos=pos=>{
    const cur={lat:pos.coords.latitude, lng:pos.coords.longitude};
    if(Store.data.locSafeSpot) this._locDist=this._haversine(cur.lat, cur.lng, Store.data.locSafeSpot.lat, Store.data.locSafeSpot.lng);
    this._checkLocAlert();
    this.renderLocStatus();
  };
  const onErr=()=>{ this._locDist=null; this.renderLocStatus(); };
  this._locWatchId=navigator.geolocation.watchPosition(onPos, onErr, {enableHighAccuracy:true, maximumAge:15000, timeout:12000});
  clearInterval(this._locTick);
  this._locTick=setInterval(()=>{ this._checkLocAlert(); this.renderLocStatus(); }, 30000);
},
_stopLocWatch(){
  if(this._locWatchId!=null && navigator.geolocation){ try{ navigator.geolocation.clearWatch(this._locWatchId); }catch(e){} }
  this._locWatchId=null;
  if(this._locTick){ clearInterval(this._locTick); this._locTick=null; }
},
_checkLocAlert(){
  if(!Store.data.locGuard || !Store.data.locSafeSpot || this._locDist==null) return;
  if(this._locAlerted||this._locAlertPending) return;
  if(this._locDist>Store.data.locThreshold && (this._locDemoMode==='danger'||this._isDangerTime())){
    const km=(this._locDist/1000).toFixed(1);
    const eventId=this.sendGuardianAlert('深夜偏离预警','距常用地点 '+km+' 公里');
    if(eventId){this._locAlerted=true;this._locAlertEventId=eventId}
    else this._locAlertPending=true;
  }
},
_isDangerTime(){
  const from=Store.data.locDangerFrom||'23:00', to=Store.data.locDangerTo||'06:00';
  const now=new Date(), cur=now.getHours()*60+now.getMinutes();
  const f=this._hhmm2min(from), t=this._hhmm2min(to);
  if(f<=t) return cur>=f && cur<=t;
  return cur>=f || cur<=t;
},
_hhmm2min(s){ const p=(s||'').split(':'); return (parseInt(p[0])||0)*60+(parseInt(p[1])||0); },
_haversine(lat1,lon1,lat2,lon2){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  return 2*R*Math.asin(Math.sqrt(a));
},
_escapeHtml(value){return String(value==null?'':value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))},
renderContacts(){
  const list=$('ct-list'),cs=Store.data.contacts||[];if(!list)return;
  if(!cs.length){list.innerHTML='<div class="ct-empty">还没有设置紧急联系人</div>';return}
  list.innerHTML=cs.map((c,i)=>{
    const verified=c.status==='verified';
    const testing=c.status==='testing';
    return `<div class="ct-item"><div class="ct-avatar">👤</div><div class="ct-info"><span class="ct-name">${this._escapeHtml(c.name)} <i class="ct-relation">${this._escapeHtml(c.relation||'联系人')}</i></span><span class="ct-tel">${this._escapeHtml(c.tel)}</span><span class="ct-status ${verified?'verified':'pending'}">${verified?'已验证':testing?'发送中':'待验证'}</span></div>${verified||testing?'':`<button class="ct-test" data-testidx="${i}">测试</button>`}<button class="ct-del" data-ctidx="${i}" title="删除">✕</button></div>`;
  }).join('');
  list.querySelectorAll('.ct-test').forEach(b=>b.onclick=e=>this.testContact(Number(e.currentTarget.dataset.testidx)));
  list.querySelectorAll('.ct-del').forEach(b=>b.onclick=e=>{const i=Number(e.currentTarget.dataset.ctidx);if(!Number.isInteger(i))return;Store.data.contacts.splice(i,1);Store.save();this.renderContacts();this.toast('已删除')});
},
showContactEditor(){$('ct-editor').style.display='block';$('ct-name-input').value='';$('ct-tel-input').value='';$('ct-relation-input').value='家人'},
hideContactEditor(){$('ct-editor').style.display='none'},
saveContact(){
  const n=$('ct-name-input').value.trim(),t=$('ct-tel-input').value.trim(),relation=$('ct-relation-input').value;
  if(!n||!t){this.toast('请填写姓名和电话');return}
  if(!/^1\d{10}$/.test(t)){this.toast('请输入 11 位手机号码');return}
  if(!Store.data.contacts)Store.data.contacts=[];
  Store.data.contacts.push({name:n,tel:t,relation,status:'pending'});Store.save();this.hideContactEditor();this.renderContacts();this.toast('已添加 '+n+'，请发送测试通知');
},
testContact(index){
  const c=(Store.data.contacts||[])[index];if(!c)return;
  c.status='testing';Store.save();this.renderContacts();
  this.toast('正在模拟发送测试通知…');
  const eventId=this.addGuardEvent('联系人测试',c.name,'发送中','线上演示');
  setTimeout(()=>{
    const stillExists=(Store.data.contacts||[]).includes(c);
    if(stillExists){c.status='verified';c.verifiedAt=Date.now()}
    this.updateGuardEvent(eventId,'模拟送达');Store.save();this.renderContacts();this.renderGuardEvents();this.renderLocStatus();
    if(stillExists&&this._locAlertPending){this._locAlertPending=false;this._checkLocAlert();this.renderLocStatus()}
    this.toast(stillExists?'测试通知已模拟送达，联系人已验证':'联系人已删除，测试通知已结束');
  },700);
},
addGuardEvent(type,who,status,detail){
  if(!Store.data.guardianEvents)Store.data.guardianEvents=[];
  const event={id:'GE-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),type,who,status,detail,createdAt:Date.now(),demo:true};
  Store.data.guardianEvents.unshift(event);
  Store.data.guardianEvents=Store.data.guardianEvents.slice(0,12);Store.save();this.renderGuardEvents();
  return event.id;
},
updateGuardEvent(id,status){
  const event=(Store.data.guardianEvents||[]).find(x=>x.id===id);if(event){event.status=status;event.updatedAt=Date.now();Store.save()}
},
renderGuardEvents(){
  const list=$('guard-events');if(!list)return;const events=Store.data.guardianEvents||[];
  if(!events.length){list.innerHTML='<div class="ct-empty">暂无事件，测试通知和 SOS 会记录在这里</div>';return}
  list.innerHTML=events.slice(0,5).map(e=>{const time=new Date(e.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});return `<div class="guard-event"><span class="guard-event-dot ${e.status==='发送中'?'sending':'done'}"></span><div><b>${this._escapeHtml(e.type)}</b><small>${this._escapeHtml(e.who||'')} · ${time}${e.detail?' · '+this._escapeHtml(e.detail):''}</small></div><i>${this._escapeHtml(e.status)}</i></div>`}).join('');
},
sendGuardianAlert(type,detail){
  const cs=Store.data.contacts||[],contact=cs.find(c=>c.status==='verified');
  if(!contact){
    this.toast(cs.length?'请先测试并验证紧急联系人':'请先添加并验证紧急联系人');
    if(!cs.length)this.showContactEditor();
    this.renderLocStatus();
    return null;
  }
  const eventId=this.addGuardEvent(type,contact.name,'发送中',detail||'');
  this.toast('正在模拟发送给「'+contact.name+'」…');
  setTimeout(()=>{this.updateGuardEvent(eventId,'模拟送达');this.renderGuardEvents();this.renderLocStatus();this.toast('模拟通知已送达「'+contact.name+'」')},800);
  return eventId;
},
// ── 模拟来电 ────────────────────────────────────
fakeCallRole:'mom',
fakeCallMood:'normal',
fakeCallRoles:{mom:'妈妈',bff:'闺蜜',bf:'男友',dad:'爸爸',yaya:'瓦奇'},
fakeCallAvatars:{mom:'👩',bff:'👭',bf:'👦',dad:'👨',yaya:'🦷',custom:'✏️'},
fakeCallVoices:{
  mom:'zh-CN-XiaoxiaoNeural',
  bff:'zh-CN-XiaoyiNeural',
  bf:'zh-CN-YunxiNeural',
  dad:'zh-CN-YunjianNeural',
  yaya:'zh-CN-XiaoxiaoNeural'
},
fakeCallScripts:{
  mom:{normal:['闺女，都几点啦，怎么还不回来？','饭都给你热两遍了，赶紧回来吃饭。','路上注意安全啊。'],urgent:['闺女，赶紧回来！','家里出事了，立马回来！','快，别磨蹭了！']},
  bff:{normal:['喂，你到哪儿啦？','我们几个都在等你呢，就差你啦。','快过来嘛！'],urgent:['喂，你快回来！','有急事找你，立马过来！','快点快点！']},
  bf:{normal:['宝宝，你在哪儿呢？','我想你了，什么时候回来呀？','要不要我去接你？'],urgent:['宝宝，你现在立马回来！','我这边有急事，需要你马上回来。','路上小心，我等你。']},
  dad:{normal:['闺女，这么晚了还不回来？','外面不安全，早点回家。','我出来接你吧。'],urgent:['闺女，马上回家！','家里有急事，立刻回来。','路上注意安全。']},
  yaya:{normal:['喂，你在哪儿呢？','你快递到了，挺急的，能回来一下吗？','好，那我等你哦。'],urgent:['喂，你赶紧回来！','家里水龙头爆了，客厅都淹了。','立马回来，快！']}
},
simulateCall(delay){
  if(delay>0) this.toast('瓦奇将在 '+delay+' 秒后打给你，先收起手机');
  this.endCall();
  this._fcT=setTimeout(()=>this.showCallOverlay(), delay*1000);
},
// 当前来电的完整信息（名字/头像/号码/台词/音色），自定义角色从这里读输入框
_fcRoleInfo(){
  const role=this.fakeCallRole;
  if(role==='custom'){
    const name=($('fc-custom-name')&&$('fc-custom-name').value||'').trim()||'未知来电';
    const num=($('fc-custom-num')&&$('fc-custom-num').value||'').trim();
    const raw=($('fc-custom-script')&&$('fc-custom-script').value||'').trim();
    const lines=raw.split('\n').map(s=>s.trim()).filter(Boolean);
    const script=lines.length?lines:['喂，你在哪儿呢？','家里有点急事，能回来一下吗？'];
    return { name, avatar:'✏️', number:num, voice:'zh-CN-XiaoxiaoNeural', script:{normal:script,urgent:script}, isCustom:true };
  }
  return {
    name:this.fakeCallRoles[role]||'瓦奇',
    avatar:this.fakeCallAvatars[role]||'🦷',
    number:'',
    voice:this.fakeCallVoices[role]||'zh-CN-XiaoxiaoNeural',
    script:this.fakeCallScripts[role]||this.fakeCallScripts.mom,
    isCustom:false
  };
},
showCallOverlay(){
  this.closeMask();
  const ov=$('call-overlay'); if(!ov) return;
  const info=this._fcRoleInfo();
  $('call-status').textContent='来电…';
  $('call-script').textContent='';
  $('call-timer').style.display='none';
  $('btn-call-accept').style.display='block';
  $('btn-call-decline').style.display='block';
  const nm=$('call-name'); if(nm) nm.textContent=info.name;
  const av=$('call-avatar'); if(av) av.textContent=info.avatar;
  const num=$('call-number'); if(num){ if(info.number){ num.textContent=info.number; num.style.display='block'; } else { num.style.display='none'; } }
  ov.classList.add('on');
},
answerCall(){
  const mood=this.fakeCallMood;
  const info=this._fcRoleInfo();
  const script=info.isCustom ? (info.script.normal) : (info.script[mood]||info.script.normal);
  $('call-status').textContent='通话中 · '+info.name;
  $('btn-call-accept').style.display='none';
  const t=$('call-timer'); t.style.display='block'; t.textContent='00:00';
  this._callStart=Date.now();
  clearInterval(this._callTick);
  this._callTick=setInterval(()=>{const s=Math.floor((Date.now()-this._callStart)/1000);t.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},500);
  $('call-script').textContent=script.join(' ');
  this._speakCall(script, info.voice);
},
endCall(){
  clearTimeout(this._fcT); clearInterval(this._callTick);
  if(this._fcAudio){ try{this._fcAudio.pause();this._fcAudio.src='';}catch(e){} this._fcAudio=null; }
  if(window.speechSynthesis) speechSynthesis.cancel();
  const ov=$('call-overlay'); if(ov) ov.classList.remove('on');
},
async _speakCall(lines, voice){
  voice=voice||'zh-CN-XiaoxiaoNeural';
  const text=lines.join('。');
  try{
    const resp=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice})});
    if(!resp.ok) throw new Error('tts '+resp.status);
    const blob=await resp.blob();
    const url=URL.createObjectURL(blob);
    const a=new Audio(url);
    this._fcAudio=a;
    a.onended=()=>{ try{URL.revokeObjectURL(url)}catch(e){} };
    a.play().catch(()=>{});
  }catch(e){
    this._speakFallback(lines);
  }
},
_speakFallback(lines){
  if(!window.speechSynthesis) return;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(lines.join('。'));
    u.lang='zh-CN'; u.rate=1; u.pitch=1.1;
    const voices=speechSynthesis.getVoices();
    const zh=voices.find(v=>v.lang&&v.lang.toLowerCase().indexOf('zh')===0);
    if(zh) u.voice=zh;
    speechSynthesis.speak(u);
  }catch(e){}
},
confirmCall(who){
  if(who==='紧急联系人'){
    const contacts=Store.data.contacts||[];
    if(!contacts.length){this.toast('请先添加紧急联系人');this._openShieldView('sos');this.showContactEditor();return}
    if(!contacts.some(c=>c.status==='verified')){this.toast('请先发送测试通知并验证联系人');this._openShieldView('sos');return}
  }
  this._pendingGuardianAction=who;
  $('confirm-desc').textContent='确定要触发'+who+'吗？线上演示不会拨出真实电话。';$('modal-confirm').classList.add('on')
},
confirmGuardianAction(){
  const who=this._pendingGuardianAction;this._pendingGuardianAction=null;this.closeModal();
  if(who==='紧急联系人'){
    if(this.sendGuardianAlert('手动 SOS','用户长按触发'))this.addMsg('yy','守护演示已触发，我会陪着你等联系人回应。');
  }else if(who){
    this.addGuardEvent('紧急呼叫',who,'模拟触发','演示模式未拨出真实电话');this.toast('已模拟触发 '+who);this.addMsg('yy','紧急呼叫演示已触发。真实版本会在这里拨出电话。');
  }
  this.renderGuardEvents();
},
closeModal(){$('modal-confirm').classList.remove('on')},

openPopover(){$('pop-calendar').classList.add('on');$('mask').classList.add('on');this.renderTodayHero()},
closePopover(){$('pop-calendar').classList.remove('on');$('mask').classList.remove('on')},

// ── 通用编辑 Sheet ─────────────────────────────────
openEditor(title,fields,onSave){
  const t=$('edit-title'); if(t) t.textContent=title;
  const box=$('edit-fields'); if(!box) return;
  box.innerHTML=fields.map(f=>{
    let input='';
    if(f.type==='date') input=`<input class="ef-input" data-key="${f.key}" type="date" value="${f.value||''}">`;
    else if(f.type==='select') input=`<select class="ef-input" data-key="${f.key}">${(f.options||[]).map(o=>`<option value="${o.v}" ${o.v===f.value?'selected':''}>${o.t}</option>`).join('')}</select>`;
    else input=`<input class="ef-input" data-key="${f.key}" type="${f.type||'text'}" value="${f.value||''}">`;
    return `<label class="ef-row"><span class="ef-label">${f.label}</span>${input}</label>`;
  }).join('');
  this._editorOnSave=onSave;
  $('sheet-edit').classList.add('on'); $('mask').classList.add('on');
},
editorSave(){
  const out={};
  $$('#edit-fields .ef-input').forEach(el=>{ out[el.dataset.key]=el.value; });
  const fn=this._editorOnSave; this._editorOnSave=null;
  this.closeMask();
  if(fn) fn(out);
},

// ── 守护场景库（见 renderScenarios，已接管原静态 tabs） ──

// ── Nurture Tab Subtabs ─────────────────────────────
bindNurtureSubtabs(){
  document.querySelectorAll('[data-nurtab]').forEach(b=>{b.onclick=()=>{
    document.querySelectorAll('[data-nurtab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    document.querySelectorAll('#tab-nurture .hb-panel').forEach(p=>p.classList.remove('active'));
    const panel=document.getElementById('nur-panel-'+b.dataset.nurtab);if(panel)panel.classList.add('active');
  }});
},

// ── Game Launch ───────────────────────────────────
bindGameLaunch(){
  document.querySelectorAll('.game-card-3').forEach(card=>{
    card.onclick=()=>{
      const game=card.dataset.game;
      const map={jump:'games/jump-game.html',catch:'games/catch-game.html',run:'games/run-game.html'};
      if(map[game]){
        const wrap=document.getElementById('game-frame-wrap');
        const frame=document.getElementById('game-frame');
        if(wrap&&frame){wrap.style.display='flex';frame.src=map[game]}
      }
    };
  });
  const backBtn=document.getElementById('game-back-btn');
  if(backBtn)backBtn.onclick=()=>{
    const wrap=document.getElementById('game-frame-wrap');
    const frame=document.getElementById('game-frame');
    if(wrap){wrap.style.display='none'}
    if(frame){frame.src=''}
  };
},

// ── 健康编辑 ──────────────────────────────────────
bindHealthEditors(){
  const b1=$('btn-edit-period'); if(b1) b1.onclick=()=>this.openEditor('编辑经期',[
    {key:'lastStart',label:'上次经期开始',type:'date',value:Store.data.period.lastStart},
    {key:'cycleLen',label:'周期天数',type:'number',value:Store.data.period.cycleLen}
  ],v=>{Store.data.period={lastStart:v.lastStart,cycleLen:Math.max(15,parseInt(v.cycleLen)||28)};Store.save();this.renderHealth();this.toast('经期已更新');});
  const b2=$('btn-edit-mani'); if(b2) b2.onclick=()=>this.openEditor('编辑美甲',[
    {key:'last',label:'上次美甲日期',type:'date',value:Store.data.manicure.last}
  ],v=>{Store.data.manicure.last=v.last;Store.save();this.renderHealth();this.toast('美甲已更新');});
  const mp=$('mani-photo-input'); if(mp) mp.onchange=e=>{const f=e.target.files[0]; if(f) this.onManiPhotoPicked(f); mp.value=''; };
  const b3=$('btn-edit-hair'); if(b3) b3.onclick=()=>this.openEditor('编辑洗头',[
    {key:'last',label:'上次洗头日期',type:'date',value:Store.data.hair.last},
    {key:'type',label:'发质类型',type:'select',value:Store.data.hair.type,options:[{v:'oily',t:'细软发 · 偏油'},{v:'normal',t:'中性发'},{v:'dry',t:'干性发'}]}
  ],v=>{const iv=v.type==='oily'?2:3;Store.data.hair={last:v.last,type:v.type,interval:iv};Store.save();this.renderHealth();this.toast('洗头日历已更新');});
  const b4=$('btn-edit-health'); if(b4) b4.onclick=()=>this.openEditor('编辑今日身体数据（自报）',[
    {key:'steps',label:'今日步数',type:'number',value:Store.data.health.steps},
    {key:'hr',label:'静息心率',type:'number',value:Store.data.health.hr},
    {key:'sleep',label:'昨晚睡眠',type:'text',value:Store.data.health.sleep}
  ],v=>{const h=Store.data.health;h.steps=parseInt(v.steps)||0;h.hr=parseInt(v.hr)||0;h.sleep=v.sleep;h.reported=this.todayStr();h.weekSteps[6]=h.steps;Store.save();this.renderHealth();this.toast('身体数据已保存');});
},

// ── 日记 ──────────────────────────────────────────
bindDiary(){
  const b=$('btn-write-diary'); if(!b) return;
  const moods=['😢','😞','😐','😊','😄'];
  const box=$('diary-mood'); if(box){ box.innerHTML=moods.map((m,i)=>`<button class="dm-emoji" data-mood="${i+1}">${m}</button>`).join(''); this._diaryMood=4; box.querySelectorAll('.dm-emoji').forEach(el=>{ el.onclick=()=>{ this._diaryMood=parseInt(el.dataset.mood); box.querySelectorAll('.dm-emoji').forEach(x=>x.classList.remove('sel')); el.classList.add('sel'); } }); box.querySelector('.dm-emoji:nth-child(4)').classList.add('sel'); }
  b.onclick=()=>{ $('diary-text').value=''; $('sheet-diary').classList.add('on'); $('mask').classList.add('on'); };
  const save=$('diary-save'); if(save) save.onclick=()=>this.saveDiary();
},
saveDiary(){
  const txt=($('diary-text').value||'').trim(); if(!txt){ this.toast('写点什么再保存吧～'); return; }
  const now=new Date();
  const entry={date:(now.getMonth()+1)+'月'+now.getDate()+'日 今天',mood:this._diaryMood||4,author:'user',weather:this.weather.emoji+' '+this.weather.temp,text:txt,ts:Date.now()};
  Store.data.diary.unshift(entry); Store.save();
  this.closeMask(); this.renderTimeline(); this.renderSparkline();
  this.award(10,'写日记'); this.showBubble('收到！今天的你，我都记在心里啦。');
},
allDiary(){ return [...(this._convDiary||[]), ...Store.data.diary, ...this.diaryEntries()]; },

// 从服务器拉取对话日记（语音+网页对话），合并进手账时间轴
async loadConversationDiary(){
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  try {
    const r = await fetch('/api/diary/conversations');
    const d = await r.json();
    this._convDiary = (d.entries||[]).map(e => {
      const p = (e.date||'').split('-');
      const dateStr = (parseInt(p[1])||0)+'月'+(parseInt(p[2])||0)+'日'+(e.time?' '+e.time:'');
      return { date: dateStr, mood: 4, author: 'yaya', weather: '', text: '我说「'+esc(e.user)+'」<br>瓦奇「'+esc(e.yaya)+'」', ts: e.ts||0 };
    }).sort((a,b)=>(b.ts||0)-(a.ts||0));
  } catch(e) { this._convDiary = []; }
  this.renderTimeline(); this.renderSparkline(); this.renderWeather();
},

// ── Calendar ────────────────────────────────────────
renderCalendar(){
  const g=$('cal-grid');if(!g)return;
  const now=new Date(),m=now.getMonth()+1,y=now.getFullYear(),today=now.getDate();
  const dim=new Date(y,m,0).getDate(),sd=new Date(y,m-1,1).getDay();
  const fd=new Set();Object.keys(this.womenHistory).forEach(k=>{const[mm,dd]=k.split('-').map(Number);if(mm===m)fd.add(dd)});
  let h='';['日','一','二','三','四','五','六'].forEach(d=>{h+='<div class="cal-cell head">'+d+'</div>'});
  for(let i=0;i<sd;i++)h+='<div class="cal-cell"></div>';
  for(let d=1;d<=dim;d++){let c='cal-cell';if(d===today)c+=' today';if(fd.has(d))c+=' feat';h+='<div class="'+c+'" data-day="'+d+'">'+d+'</div>'}
  g.innerHTML=h;
  g.querySelectorAll('.cal-cell[data-day]').forEach(cell=>{cell.onclick=()=>{const d=parseInt(cell.dataset.day);const k=m+'-'+d;if(this.womenHistory[k])this.renderTodayHero(k)}});
},

renderTodayHero(ok){
  const now=new Date();const k=ok||(now.getMonth()+1)+'-'+now.getDate();
  const hero=this.womenHistory[k]||{name:'你',year:'今天',emoji:'🌟',desc:'每一天都有女性在创造历史。也许今天的主角就是你。',quote:'「历史不只在书中——它也在你正在写的这一页。」'};
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v};
  set('cal-thero',hero.emoji);set('cal-tname',hero.name);set('cal-tyear',hero.year);set('cal-tdesc',hero.desc);set('cal-tquote',hero.quote);
  const ph=document.querySelector('.pop-hero'),pd=document.querySelector('.pop-desc');
  if(ph)ph.textContent=hero.emoji+' '+hero.name+' · '+hero.year;
  if(pd)pd.textContent=hero.desc.slice(0,80)+'…';
},

async renderNewsFeed(){
  const f=document.getElementById('cal-news-feed');if(!f)return;
  f.innerHTML='<div class="cal-news-loading">正在加载最新女性资讯…</div>';
  let items=[];
  try{const r=await fetch('/api/women-news');const d=await r.json();items=d.items||[]}catch(e){}
  if(!items.length){f.innerHTML='<div class="cal-news-empty">暂时加载不到最新资讯，请检查网络后再试</div>';return;}
  f.innerHTML=items.map(n=>`<a class="cal-ncard" href="${n.url}" target="_blank" rel="noopener"><div class="cal-nbody"><div class="cal-nhead">${n.title}</div><div class="cal-nmeta">${n.source} · ${n.date}</div></div><span class="cal-narrow">›</span></a>`).join('');
},

// ── Timeline ────────────────────────────────────────
renderTimeline(){
  const tl=$('timeline');if(!tl)return;tl.innerHTML='';
  this.allDiary().forEach(d=>{
    const day=document.createElement('div');day.className='day';if(d.milestone)day.classList.add('milestone');if(d.period)day.classList.add('period');
    const tag=d.tag?'<span class="day-tag '+d.tag.cls+'">'+d.tag.text+'</span>':'';
    const al=d.author==='user'?'<span class="day-author">✎ 我的记录</span>':'<span class="day-author">yaya日记</span>';const wx=d.weather?'<div class="day-weather">'+d.weather+'</div>':'';
    const ec=d.author==='user'?'day-entry user':'day-entry';
    day.innerHTML='<div class="day-date">'+d.date+'</div><div class="'+ec+'">'+tag+al+wx+d.text+'</div>';tl.appendChild(day)});
},

renderSparkline(){
  const l=$('sparkline');if(!l)return;
  const pts=this.allDiary().map(d=>d.mood).reverse(),w=300,h=40;
  const sX=pts.length>1?w/(pts.length-1):w;
  const points=pts.map((m,i)=>((i*sX).toFixed(1))+','+(h-((m-1)/4)*(h-8)-4).toFixed(1)).join(' ');
  l.setAttribute('points',points);
},

renderWeather(){
  const w=this.weather;
  const all=this.allDiary(); const moods=['😢 低落','😞 不太好','😐 一般','😊 不错','😄 很开心'];
  if(all.length) w.mood=moods[all[0].mood]||w.mood;
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  s('weather-emoji',w.emoji);s('weather-temp',w.temp);s('weather-desc',w.desc);s('weather-moodval',w.mood);
},

renderHealth(){
  const d=Store.data;
  // 经期
  this.renderPeriod();
  // 美甲
  this.renderManicure();
  // 洗头
  this.renderHair();
  // 身体数据
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  s('hs-steps',d.health.steps>0?d.health.steps.toLocaleString():'—');
  s('hs-hr',d.health.hr>0?d.health.hr:'—');
  s('hs-sleep',d.health.sleep||'未记录');
  const bars=document.getElementById('hw-bars');if(bars){
    if(!d.health.weekSteps.some(st=>st>0)){
      bars.innerHTML='<div style="color:#9aa0a6;font-size:12px;padding:14px 0;text-align:center;width:100%">还没有步数记录<br>点右上角「编辑」填入今天的吧</div>';
    }else{
      bars.innerHTML='';
      const days=['一','二','三','四','五','六','日'];const max=Math.max(...d.health.weekSteps,1000);
      d.health.weekSteps.forEach((st,i)=>{
        const col=document.createElement('div');col.style.cssText='flex:1;display:flex;flex-direction:column;align-items:center;gap:4px';
        const bar=document.createElement('div');bar.className='hw-bar';bar.style.height=Math.max(4,st/max*80)+'px';
        bar.textContent=st>=1000?Math.round(st/1000)+'k':'';col.appendChild(bar);
        const lbl=document.createElement('div');lbl.className='hw-bar-day';lbl.textContent=days[i];col.appendChild(lbl);
        bars.appendChild(col);
      });
    }
  }
},

renderPeriod(){
  const p=Store.data.period; const t=this.todayStr();
  const s=(id,v)=>{const el=$(id);if(el)el.textContent=v};
  if(!p.lastStart){
    s('period-next','未设置');
    s('period-phase','待填写');
    s('period-cycle','点「编辑」填上次经期日期');
    s('period-tip','💡 填好后，瓦奇就能帮你算周期、提前提醒姨妈期啦');
    return;
  }
  let next=p.lastStart;
  while(this.daysBetween(t,next)<0) next=this.addDays(next,p.cycleLen);
  const daysLeft=this.daysBetween(t,next);
  const cycleDay=((this.daysBetween(p.lastStart,t)%p.cycleLen)+p.cycleLen)%p.cycleLen+1;
  let phase,tip;
  if(cycleDay<=5){phase='月经期';tip='💡 注意保暖、少碰生冷，疼的话喝点红糖水';}
  else if(cycleDay<=13){phase='卵泡期';tip='💡 卵泡期精力充沛，适合运动和社交';}
  else if(cycleDay<=16){phase='排卵期';tip='💡 排卵期可能轻微不适，多喝水多休息';}
  else {phase='黄体期';tip='💡 黄体期情绪易波动，允许自己慢一点';}
  s('period-next', daysLeft===0?'就是今天':'还有'+daysLeft+'天');
  s('period-phase',phase);
  s('period-cycle','第 '+cycleDay+' 天 · 周期'+p.cycleLen+'天');
  s('period-tip',tip);
},

renderManicure(){
  const m=Store.data.manicure; const t=this.todayStr();
  const s=(id,v)=>{const el=$(id);if(el)el.textContent=v};
  this.renderManiPhoto(m);
  if(!m.last){
    s('mani-last','未设置');
    s('mani-status','待填写');
    s('mani-next','点「编辑」填上次美甲日期');
    s('mani-tip','💡 填好后瓦奇会提醒你什么时候该换新');
    return;
  }
  const daysAgo=this.daysBetween(m.last,t);
  let next=this.addDays(m.last,m.interval);
  while(this.daysBetween(t,next)<0) next=this.addDays(next,m.interval);
  const daysLeft=this.daysBetween(t,next);
  let status,tip;
  if(daysAgo<7){status='状态良好';tip='💡 颜色还很漂亮，继续保持';}
  else if(daysAgo<14){status='轻微脱落';tip='💡 甲缘有些干燥，记得涂指缘油哦～';}
  else if(daysAgo<21){status='明显脱落';tip='💡 边缘起翘了，可以预约换新啦';}
  else {status='需要更换';tip='💡 超过三周啦，安排一次美甲放松下～';}
  s('mani-last',this.fmtDate(m.last)+' · '+daysAgo+'天前');
  s('mani-status',status);
  s('mani-next',this.fmtDate(next)+' · 还有'+daysLeft+'天');
  s('mani-tip',tip);
},
renderManiPhoto(m){
  const ph=document.getElementById('mani-photo'); if(!ph) return;
  if(m.photo){
    ph.innerHTML='<img class="mani-photo-img" src="'+m.photo+'"><button class="mani-photo-del" onclick="App.removeManiPhoto()">✕ 删除</button>';
  }else{
    ph.innerHTML='<button class="mani-photo-btn" onclick="App.pickManiPhoto()">📷 拍张美甲照记录一下</button>';
  }
},
pickManiPhoto(){ const inp=document.getElementById('mani-photo-input'); if(inp) inp.click(); },
async onManiPhotoPicked(file){ const src=await this.compressImage(file); Store.data.manicure.photo=src; Store.save(); this.renderHealth(); this.toast('美甲照已保存'); },
removeManiPhoto(){ Store.data.manicure.photo=''; Store.save(); this.renderHealth(); this.toast('已删除美甲照'); },

renderHair(){
  const h=Store.data.hair; const t=this.todayStr();
  const typeMap={oily:'细软发 · 偏油',normal:'中性发',dry:'干性发'};
  const freqMap={oily:'隔天一次',normal:'两三天一次',dry:'三四天一次'};
  const s=(id,v)=>{const el=$(id);if(el)el.textContent=v};
  if(!h.last){
    s('hair-last','未设置');
    s('hair-type',typeMap[h.type]||h.type);
    s('hair-freq',freqMap[h.type]||('每'+h.interval+'天'));
    s('hair-tip','💡 点「编辑」填上次洗头日期，瓦奇帮你排洗头日历');
    const hc=document.getElementById('hair-mini-cal');if(hc)hc.innerHTML='';
    return;
  }
  let next=h.last;
  while(this.daysBetween(t,next)<0) next=this.addDays(next,h.interval);
  s('hair-last',this.fmtDate(h.last));
  s('hair-type',typeMap[h.type]||h.type);
  s('hair-freq',freqMap[h.type]||('每'+h.interval+'天'));
  s('hair-tip','💡 下次洗头建议：'+(this.daysBetween(t,next)===0?'今天':'明天或'+this.fmtDate(next))+'，记得用护发素哦～');
  // 未来7天日历
  const hc=document.getElementById('hair-mini-cal');if(hc){hc.innerHTML='';
  for(let i=0;i<7;i++){
    const d=this.addDays(t,i);
    const gap=this.daysBetween(h.last,d);
    const isWash=gap>=0 && gap%h.interval===0;
    const isToday=i===0;
    const div=document.createElement('div');div.className='hair-day'+(isWash?' wash':'')+(isToday?' today':'');
    div.innerHTML='<span class="hd-date">'+this.parseDate(d).getDate()+'</span><span class="hd-icon">'+(isWash?'💧':'·')+'</span>';
    hc.appendChild(div);
  }}
},

// ── 记忆管理页 ────────────────────────────────────
renderMemoryPage(){
  const list=$('memory-list'); if(!list) return;
  const d=Store.data;
  const typeMap={名字:'👤',喜欢:'💗',不喜欢:'🙅',经期:'🩸',生日:'🎂'};
  if(!d.memories.length){
    list.innerHTML='<div class="mem-empty">瓦奇还没有记住什么。<br>多跟她说说你自己吧，比如"我叫…"、"我喜欢…"。</div>';
  }else{
    list.innerHTML=d.memories.map((m,i)=>{
      const label=typeMap[m.type]||'📌';
      return `<div class="mem-item"><span class="mem-ico">${label}</span><div class="mem-bd"><div class="mem-type">${m.type}</div><div class="mem-text">${m.text}</div></div><button class="mem-del" onclick="App.delMemory(${i})">✕</button></div>`;
    }).join('');
  }
  const cnt=$('memory-count'); if(cnt) cnt.textContent='瓦奇记住了 '+d.memories.length+' 件事 · 聊过 '+d.chatHistory.length+' 条';
},
delMemory(i){
  Store.data.memories.splice(i,1); Store.save(); this.renderMemoryPage(); this.toast('已删除这条记忆');
},
clearMemory(){
  Store.data.memories=[]; Store.save(); this.renderMemoryPage(); this.toast('记忆已清空');
},

bindHandbookSubtabs(){
  document.querySelectorAll('[data-hbtab]').forEach(b=>{b.onclick=()=>{
    document.querySelectorAll('[data-hbtab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    document.querySelectorAll('#tab-handbook .hb-panel').forEach(p=>p.classList.remove('active'));
    const panel=document.getElementById('hb-panel-'+b.dataset.hbtab);if(panel)panel.classList.add('active');
  }});
  const sparkHint=document.getElementById('spark-hint');
  if(sparkHint)sparkHint.onclick=()=>this.showMoodDetail();
},

showMoodDetail(){
  const moods=this.allDiary().map(d=>({date:d.date,mood:d.mood,text:d.text.slice(0,30)+'…'}));
  const labels=['','😢 低落','😞 不太好','😐 一般','😊 不错','😄 很开心'];
  let html='<div class="mood-pop-head">📊 情绪详情</div>';
  moods.forEach(m=>{html+='<div class="mood-pop-row"><span>'+m.date+'</span><span>'+labels[m.mood]+'</span></div>'});
  const pop=document.createElement('div');pop.className='mood-popup';pop.innerHTML=html+'<button class="mood-pop-close">关闭</button>';
  pop.querySelector('.mood-pop-close').onclick=()=>pop.remove();
  pop.onclick=e=>{if(e.target===pop)pop.remove()};
  document.getElementById('phone').appendChild(pop);
},

// ── First Visit ─────────────────────────────────────
showLoadingThenGreet(){
  const ld=document.createElement('div');ld.className='loading-screen';ld.id='loading-screen';
  ld.innerHTML='<div class="loading-yaya">🧸</div><div class="loading-text">正在找瓦奇…</div>';
  $('phone').appendChild(ld);
  setTimeout(()=>{ld.classList.add('hide');setTimeout(()=>ld.remove(),400);
    this.showBubble('啊，你来啦！');
    setTimeout(()=>{this.addMsg('yy','我是瓦奇～以后你就是我的主人啦。');this.addMsg('yy','你今天过得怎么样？')},600);
    const mic=$('btn-mic');if(mic){mic.classList.add('pulse');setTimeout(()=>mic.classList.remove('pulse'),6000)}
    Store.data.flags.greeted=true;Store.save();},1200);
},

};

document.addEventListener('DOMContentLoaded',()=>App.init());
