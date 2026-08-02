-- NFC标签绑定表 + 宠物自主活动日志

CREATE TABLE IF NOT EXISTS nfc_bindings (
    nfc_uid     VARCHAR(14) PRIMARY KEY,  -- NTAG215 7字节UID的hex编码
    user_id     UUID REFERENCES users(id),
    species     VARCHAR(16) NOT NULL,
    name        VARCHAR(64) DEFAULT '灵伴',
    status      VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active','unbound','transferred')),
    bound_at    TIMESTAMPTZ DEFAULT now(),
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_nfc_user ON nfc_bindings(user_id, status);

CREATE TABLE IF NOT EXISTS pet_activity_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(128) NOT NULL,
    emoji       VARCHAR(8) DEFAULT '✨',
    location    VARCHAR(64) DEFAULT '灵屿',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pet_logs_user ON pet_activity_logs(user_id, created_at DESC);
CREATE INDEX idx_pet_logs_date ON pet_activity_logs(created_at::date);
