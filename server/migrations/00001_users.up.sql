CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wechat_openid   VARCHAR(128) UNIQUE NOT NULL,
    wechat_unionid  VARCHAR(128),
    nickname        VARCHAR(64) NOT NULL,
    avatar_url      VARCHAR(512),
    yaya_nickname   VARCHAR(32) DEFAULT '牙牙',
    yaya_personality_seed INT NOT NULL DEFAULT floor(random() * 100000)::INT,
    companion_days  INT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_settings (
    user_id             UUID REFERENCES users(id) PRIMARY KEY,
    voice_enabled       BOOLEAN DEFAULT false,
    greeting_time       TIME DEFAULT '08:00',
    bedtime_time        TIME DEFAULT '22:30',
    health_reminder     BOOLEAN DEFAULT true,
    period_reminder     BOOLEAN DEFAULT false,
    privacy_level       SMALLINT DEFAULT 0,
    data_sharing        BOOLEAN DEFAULT false
);
