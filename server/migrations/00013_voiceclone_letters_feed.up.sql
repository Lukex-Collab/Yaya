-- 声音克隆 + 牙牙来信 + 公共内容广场

CREATE TABLE IF NOT EXISTS voice_samples (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    duration_sec INT DEFAULT 0,
    status      VARCHAR(16) DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_models (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    voice_id    VARCHAR(64),
    name        VARCHAR(64) DEFAULT '我的声音',
    status      VARCHAR(16) DEFAULT 'training' CHECK (status IN ('training','ready','failed')),
    sample_count INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, voice_id)
);

CREATE TABLE IF NOT EXISTS weekly_letters (
    id          VARCHAR(64) PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    week        VARCHAR(32) NOT NULL,
    title       VARCHAR(256),
    content     TEXT NOT NULL,
    mood_stats  TEXT,
    highlights  TEXT,
    yaya_ps     TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, week)
);

CREATE INDEX idx_letters_user ON weekly_letters(user_id, created_at DESC);

ALTER TABLE journals ADD COLUMN IF NOT EXISTS likes INT DEFAULT 0;
ALTER TABLE journals ADD COLUMN IF NOT EXISTS comments INT DEFAULT 0;
