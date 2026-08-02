-- 实时语音通话 + 每日话题 + 怀旧引擎

CREATE TABLE IF NOT EXISTS voice_calls (
    id          VARCHAR(64) PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    status      VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active','ended','missed')),
    started_at  TIMESTAMPTZ DEFAULT now(),
    ended_at    TIMESTAMPTZ,
    duration_ms INT,
    emotion     VARCHAR(16),
    summary     TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_voice_calls_user ON voice_calls(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS daily_topics (
    id          VARCHAR(64) PRIMARY KEY,
    topic_date  DATE NOT NULL,
    category    VARCHAR(32) NOT NULL,
    question    TEXT NOT NULL,
    emoji       VARCHAR(8) DEFAULT '💭',
    yaya_intro  TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_daily_topics_date ON daily_topics(topic_date);

CREATE TABLE IF NOT EXISTS topic_responses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    topic_id    VARCHAR(64) REFERENCES daily_topics(id),
    response    TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, topic_id)
);

CREATE INDEX idx_topic_responses_user ON topic_responses(user_id, created_at DESC);
