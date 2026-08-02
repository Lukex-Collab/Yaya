-- 灵伴世界宠物状态表
CREATE TABLE IF NOT EXISTS pet_state (
    user_id      UUID REFERENCES users(id) PRIMARY KEY,
    species      VARCHAR(32) NOT NULL DEFAULT '云狐',
    name         VARCHAR(64) NOT NULL DEFAULT '云狐',
    level        INT DEFAULT 1,
    mood         VARCHAR(16) DEFAULT 'happy',
    hunger       INT DEFAULT 100 CHECK (hunger BETWEEN 0 AND 100),
    gems         INT DEFAULT 0,
    current_zone VARCHAR(32) DEFAULT 'home',
    updated_at   TIMESTAMPTZ DEFAULT now(),
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_state_zone ON pet_state(current_zone);
