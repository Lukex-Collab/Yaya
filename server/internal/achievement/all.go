package achievement

// 30+ 成就体系 — 里程碑/社交/情绪/世界/日记/健康/特殊 七大类别
type AchDef struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Desc     string `json:"desc"`
	Icon     string `json:"icon"`
	Category string `json:"category"`
	Tier     int    `json:"tier"`
	Target   int    `json:"target"`
}

var AllAchievements = []AchDef{
	// ── 里程碑 (Milestone) — 陪伴天数 ──
	{Code:"first_chat", Name:"初次见面", Desc:"完成第一次对话", Icon:"💬", Category:"milestone", Tier:1, Target:1},
	{Code:"three_days", Name:"三天小聚", Desc:"连续陪伴3天", Icon:"🌱", Category:"milestone", Tier:1, Target:3},
	{Code:"seven_days", Name:"七日之约", Desc:"连续陪伴7天", Icon:"🌟", Category:"milestone", Tier:2, Target:7},
	{Code:"fourteen_days", Name:"双周相伴", Desc:"连续陪伴14天", Icon:"🌙", Category:"milestone", Tier:2, Target:14},
	{Code:"thirty_days", Name:"三十天老友", Desc:"连续陪伴30天", Icon:"💫", Category:"milestone", Tier:3, Target:30},
	{Code:"sixty_days", Name:"花甲之谊", Desc:"累积陪伴60天", Icon:"🌸", Category:"milestone", Tier:3, Target:60},
	{Code:"hundred_days", Name:"百天同行", Desc:"陪伴100天", Icon:"👑", Category:"milestone", Tier:3, Target:100},
	{Code:"year_one", Name:"一周年", Desc:"陪伴整整365天", Icon:"🎂", Category:"milestone", Tier:4, Target:365},

	// ── 对话 (Chatter) ──
	{Code:"chatter_10", Name:"牙牙学语", Desc:"累计对话10条", Icon:"🗣️", Category:"chatter", Tier:1, Target:10},
	{Code:"chatter_100", Name:"滔滔不绝", Desc:"累计对话100条", Icon:"💬", Category:"chatter", Tier:1, Target:100},
	{Code:"chatter_500", Name:"知无不言", Desc:"累计对话500条", Icon:"📢", Category:"chatter", Tier:2, Target:500},
	{Code:"chatter_1000", Name:"话匣子", Desc:"累计对话1000条", Icon:"🎙️", Category:"chatter", Tier:2, Target:1000},
	{Code:"chatter_5000", Name:"灵魂伴侣", Desc:"累计对话5000条", Icon:"💝", Category:"chatter", Tier:3, Target:5000},

	// ── 社交 (Social) ──
	{Code:"first_friend", Name:"第一个朋友", Desc:"添加第一个好友", Icon:"🤝", Category:"social", Tier:1, Target:1},
	{Code:"five_friends", Name:"小小社交圈", Desc:"拥有5个好友", Icon:"👥", Category:"social", Tier:2, Target:5},
	{Code:"first_visit", Name:"串个门", Desc:"第一次拜访好友灵屿", Icon:"🏠", Category:"social", Tier:1, Target:1},
	{Code:"received_visit", Name:"有客来访", Desc:"第一次被好友拜访", Icon:"🚪", Category:"social", Tier:1, Target:1},

	// ── 情绪 (Mood) ──
	{Code:"happy_streak_3", Name:"三连开心", Desc:"连续3天情绪happy", Icon:"😊", Category:"mood", Tier:2, Target:3},
	{Code:"happy_streak_7", Name:"开心达人", Desc:"连续7天情绪happy", Icon:"😄", Category:"mood", Tier:3, Target:7},
	{Code:"first_gratitude", Name:"感恩之心", Desc:"写下第一篇感恩日记", Icon:"🙏", Category:"mood", Tier:1, Target:1},
	{Code:"mood_master", Name:"情绪大师", Desc:"收集所有7种情绪标签", Icon:"🎭", Category:"mood", Tier:3, Target:7},

	// ── 世界探索 (World) ──
	{Code:"first_explore", Name:"初次探索", Desc:"第一次派灵伴探索", Icon:"🗺️", Category:"world", Tier:1, Target:1},
	{Code:"zone_master", Name:"全域探索者", Desc:"探索全部5个区域", Icon:"🌍", Category:"world", Tier:2, Target:5},
	{Code:"explore_50", Name:"探险家", Desc:"累计探索50次", Icon:"⛏️", Category:"world", Tier:3, Target:50},
	{Code:"gems_1000", Name:"宝石富翁", Desc:"累积获得1000💎", Icon:"💎", Category:"world", Tier:2, Target:1000},
	{Code:"pet_level_10", Name:"初长成", Desc:"灵伴达到10级", Icon:"⬆️", Category:"world", Tier:2, Target:10},

	// ── 日记 (Journal) ──
	{Code:"journal_1", Name:"第一篇日记", Desc:"写下第一篇日记", Icon:"📝", Category:"journal", Tier:1, Target:1},
	{Code:"journal_10", Name:"日记上瘾", Desc:"累计10篇日记", Icon:"📖", Category:"journal", Tier:2, Target:10},
	{Code:"journal_30", Name:"日记达人", Desc:"累计30篇日记", Icon:"📚", Category:"journal", Tier:3, Target:30},
	{Code:"journal_100", Name:"生活记录者", Desc:"累计100篇日记", Icon:"📕", Category:"journal", Tier:4, Target:100},

	// ── 健康 (Health) ──
	{Code:"period_3m", Name:"健康管理师", Desc:"连续记录经期3个月", Icon:"🩷", Category:"health", Tier:2, Target:3},
	{Code:"body_note_10", Name:"身体觉察者", Desc:"记录10条身体状况", Icon:"💪", Category:"health", Tier:2, Target:10},

	// ── 仪式 (Ritual) ──
	{Code:"morning_7", Name:"早安鸟儿", Desc:"连续7天早安签到", Icon:"🌅", Category:"ritual", Tier:2, Target:7},
	{Code:"night_7", Name:"晚安宝贝", Desc:"连续7天晚安打卡", Icon:"🌙", Category:"ritual", Tier:2, Target:7},

	// ── 特殊 (Special) ──
	{Code:"rainy_chat", Name:"雨中呢喃", Desc:"下雨天和牙牙聊一次天", Icon:"🌧️", Category:"special", Tier:2, Target:1},
	{Code:"full_moon", Name:"月下低语", Desc:"满月之夜和牙牙说过晚安", Icon:"🌕", Category:"special", Tier:2, Target:1},
	{Code:"midnight_care", Name:"深夜守护", Desc:"0-3点牙牙陪伴过你", Icon:"🕯️", Category:"special", Tier:3, Target:1},
	{Code:"rescue_used", Name:"情绪急救站", Desc:"使用过一次情绪急救", Icon:"🆘", Category:"special", Tier:2, Target:1},
	{Code:"collector", Name:"成就收藏家", Desc:"解锁全部成就", Icon:"🏆", Category:"special", Tier:4, Target:39},
}
