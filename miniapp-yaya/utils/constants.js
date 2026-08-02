// utils/constants.js — 应用常量配置
module.exports = {
  // ═══ 云开发配置 ═══
  /** 云开发环境 ID，在微信云开发控制台获取 */
  CLOUD_ENV_ID: 'yaya-d5gf9yfw20986839f',

  /** 云函数名称 */
  CLOUD_FUNCTIONS: {
    USER_LOGIN: 'userLogin',
    AI_CHAT: 'aiChat',
    MEMORY_INGEST: 'memoryIngest',
    MEMORY_SEARCH: 'memorySearch',
    JOURNAL_GENERATE: 'journalGenerate',
    PUSH_SCHEDULE: 'pushSchedule',
    EMOTION_ANALYZE: 'emotionAnalyze',
    HEALTH_PREDICT: 'healthPredict',
  },

  // ═══ 龙珠 AI 配置 ═══
  /** AI 模型 */
  AI_MODEL: 'deepseek-chat',

  /** 牙牙性格种子（每个牙牙不同，从用户表读取，此处为默认值） */
  DEFAULT_PERSONALITY_SEED: 42,

  // ═══ 牙牙 状态 ═══
  YAYA_STATES: {
    HAPPY: 'happy',
    SLEEPY: 'sleepy',
    WORRIED: 'worried',
    EXCITED: 'excited',
    COQUETTISH: 'coquettish',
    GUARDING: 'guarding',
  },

  // ═══ 情绪类型 ═══
  EMOTIONS: {
    HAPPY: 'happy',
    SAD: 'sad',
    ANXIOUS: 'anxious',
    ANGRY: 'angry',
    CALM: 'calm',
    EXCITED: 'excited',
    TIRED: 'tired',
    NEUTRAL: 'neutral',
  },

  /** 情绪 emoji 映射 */
  EMOTION_EMOJI: {
    happy: '😊',
    sad: '😢',
    anxious: '😰',
    angry: '😤',
    calm: '😌',
    excited: '🎉',
    tired: '😴',
    neutral: '💭',
  },

  // ═══ 记忆类型 ═══
  MEMORY_TYPES: {
    FACT: 'fact',
    EVENT: 'event',
    PREFERENCE: 'preference',
    EMOTION: 'emotion',
    HEALTH: 'health',
  },

  // ═══ 关系等级 ═══
  RELATIONSHIP_LEVELS: {
    1: { name: '初识', minDays: 0, maxDays: 7, desc: '牙牙比较害羞，对话简短' },
    2: { name: '熟悉', minDays: 8, maxDays: 30, desc: '开始记住你的偏好，主动关心' },
    3: { name: '亲密', minDays: 31, maxDays: 90, desc: '深度记忆，解锁撒娇模式' },
    4: { name: '家人', minDays: 91, maxDays: 180, desc: '解锁特殊互动，牙牙会吃醋' },
    5: { name: '灵魂伴侣', minDays: 181, maxDays: Infinity, desc: '完全个性化，独一无二的存在' },
  },

  // ═══ 里程碑奖励 ═══
  MILESTONES: [
    { days: 7, reward: '牙牙第一个专属表情', type: 'emoji' },
    { days: 30, reward: '牙牙撒娇语音包', type: 'voice' },
    { days: 60, reward: '回忆相册功能', type: 'feature' },
    { days: 90, reward: '牙牙新造型（小斗篷/小围巾）', type: 'skin' },
    { days: 180, reward: '牙牙"家人"称号 + 特殊早安仪式', type: 'title' },
    { days: 365, reward: '年度回忆视频自动生成', type: 'video' },
  ],

  // ═══ 推送配置 ═══
  PUSH: {
    DAILY_LIMIT: 5,
    MIN_INTERVAL_MINUTES: 120,
    DEFAULT_MORNING_START: 7,
    DEFAULT_MORNING_END: 9,
    DEFAULT_NIGHT_START: 22,
    DEFAULT_NIGHT_END: 23.5,
  },

  // ═══ 健康 ═══
  /** 默认经期周期（天） */
  DEFAULT_PERIOD_CYCLE: 28,
  /** 默认经期持续（天） */
  DEFAULT_PERIOD_DURATION: 5,

  // ═══ 设备 ═══
  DEVICE_TYPES: {
    LIGHT: 'light',
    GUARDIAN: 'guardian',
  },
  SAFETY_STATUS: {
    SAFE: 'safe',
    ALERT: 'alert',
    OFFLINE: 'offline',
  },

  // ═══ 分页 ═══
  PAGE_SIZE: 20,
};
