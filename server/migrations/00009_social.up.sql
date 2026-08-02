-- 社交功能表: 好友/拜访/留言/动态

CREATE TABLE IF NOT EXISTS friendships (
    user_id     UUID REFERENCES users(id),
    friend_id   UUID REFERENCES users(id),
    status      VARCHAR(16) DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS world_visits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID REFERENCES users(id),
    visitor_id      UUID REFERENCES users(id),
    visitor_name    VARCHAR(64),
    visitor_emoji   VARCHAR(8) DEFAULT '🧸',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_visits_owner ON world_visits(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id    UUID REFERENCES users(id),
    to_user_id      UUID REFERENCES users(id),
    content         TEXT NOT NULL,
    is_read         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_social_msgs_to ON social_messages(to_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_feed (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    type            VARCHAR(16) CHECK (type IN ('visit','message','achievement','levelup')),
    from_user_id    UUID REFERENCES users(id),
    content         TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feed_user ON social_feed(user_id, created_at DESC);

-- 灵伴宠物状态表
CREATE TABLE IF NOT EXISTS pet_state (
    user_id     UUID REFERENCES users(id) PRIMARY KEY,
    species     VARCHAR(32) DEFAULT '云狐',
    name        VARCHAR(64) DEFAULT '灵伴',
    level       INT DEFAULT 1,
    mood        VARCHAR(16) DEFAULT 'happy',
    hunger      INT DEFAULT 100,
    gems        INT DEFAULT 0,
    current_zone VARCHAR(32) DEFAULT 'forest',
    updated_at  TIMESTAMPTZ DEFAULT now()
);
