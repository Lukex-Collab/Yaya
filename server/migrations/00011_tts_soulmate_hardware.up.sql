-- TTS语音合成 + 灵魂伴侣 + 依恋系统 + 梦境 + 硬件

-- TTS语音选择
CREATE TABLE IF NOT EXISTS user_tts_voice (
    user_id    UUID REFERENCES users(id) PRIMARY KEY,
    voice_id   VARCHAR(32) NOT NULL DEFAULT 'yaya_soft',
    selected_at TIMESTAMPTZ DEFAULT now()
);

-- TTS历史记录
CREATE TABLE IF NOT EXISTS tts_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    text        TEXT NOT NULL,
    voice_id    VARCHAR(32),
    voice_name  VARCHAR(32),
    audio_url   VARCHAR(512),
    duration_ms INT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tts_user ON tts_history(user_id, created_at DESC);

-- 配对码(6位数字，5分钟有效)
CREATE TABLE IF NOT EXISTS pair_codes (
    user_id    UUID REFERENCES users(id),
    code       VARCHAR(6) PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN DEFAULT false,
    used_by    UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 灵魂伴侣配对
CREATE TABLE IF NOT EXISTS soulmate_pairs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id    UUID REFERENCES users(id),
    user2_id    UUID REFERENCES users(id),
    yaya_bond   VARCHAR(32) DEFAULT 'best_friends',
    status      VARCHAR(16) DEFAULT 'active',
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user1_id, user2_id)
);

-- 牙牙之间的互动(灵魂伴侣的牙牙们互相聊天)
CREATE TABLE IF NOT EXISTS yaya_interactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair_id     UUID REFERENCES soulmate_pairs(id),
    from_yaya   VARCHAR(64),
    to_yaya     VARCHAR(64),
    content     TEXT NOT NULL,
    emoji       VARCHAR(8) DEFAULT '💬',
    action_type VARCHAR(32) DEFAULT 'chat',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_yaya_int_pair ON yaya_interactions(pair_id, created_at DESC);

-- 依恋签到
CREATE TABLE IF NOT EXISTS attachment_checkins (
    user_id    UUID REFERENCES users(id),
    checkin_date DATE NOT NULL,
    streak_day INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, checkin_date)
);

-- 依恋分数
CREATE TABLE IF NOT EXISTS attachment_scores (
    user_id         UUID REFERENCES users(id) PRIMARY KEY,
    closeness_score INT DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 依恋变化记录
CREATE TABLE IF NOT EXISTS attachment_deltas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    delta       INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attach_deltas_user ON attachment_deltas(user_id, created_at DESC);

-- 梦境记录
CREATE TABLE IF NOT EXISTS dreams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    dream_date  DATE NOT NULL,
    title       VARCHAR(256),
    content     TEXT NOT NULL,
    theme       VARCHAR(32),
    emoji       VARCHAR(8),
    based_on    VARCHAR(256),
    feedback    VARCHAR(32),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, dream_date)
);

-- 捕获的瞬间(生命故事)
CREATE TABLE IF NOT EXISTS captured_moments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    moment_type VARCHAR(32) NOT NULL,
    title       VARCHAR(256) NOT NULL,
    snippet     TEXT,
    emotion     VARCHAR(16),
    yaya_comment TEXT,
    emoji       VARCHAR(8) DEFAULT '✨',
    is_sealed   BOOLEAN DEFAULT false,
    captured_at DATE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_moments_user ON captured_moments(user_id, captured_at DESC);

-- 时间胶囊
CREATE TABLE IF NOT EXISTS time_capsules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    message     TEXT NOT NULL,
    sealed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    open_at     TIMESTAMPTZ,
    opened_at   TIMESTAMPTZ,
    mood_at_seal VARCHAR(32),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 牙牙关怀状态
CREATE TABLE IF NOT EXISTS yaya_care_status (
    user_id     UUID REFERENCES users(id) PRIMARY KEY,
    happiness   INT DEFAULT 80 CHECK (happiness BETWEEN 0 AND 100),
    energy      INT DEFAULT 75 CHECK (energy BETWEEN 0 AND 100),
    health      INT DEFAULT 90 CHECK (health BETWEEN 0 AND 100),
    hunger      INT DEFAULT 30 CHECK (hunger BETWEEN 0 AND 100),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 关怀行为记录
CREATE TABLE IF NOT EXISTS care_actions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action_type VARCHAR(32) NOT NULL,
    result      VARCHAR(512),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 牙牙担心事项
CREATE TABLE IF NOT EXISTS yaya_concerns (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    about       VARCHAR(256) NOT NULL,
    reason      VARCHAR(512),
    emoji       VARCHAR(8) DEFAULT '😟',
    resolved    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);
