-- 支付订单 + 订阅 + 推送消息表

CREATE TABLE IF NOT EXISTS orders (
    id              VARCHAR(64) PRIMARY KEY,
    user_id         UUID REFERENCES users(id) NOT NULL,
    amount          INT NOT NULL DEFAULT 0,
    plan            VARCHAR(32) NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','closed')),
    wx_trade_no     VARCHAR(64),
    created_at      TIMESTAMPTZ DEFAULT now(),
    paid_at         TIMESTAMPTZ
);

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    plan            VARCHAR(32) NOT NULL DEFAULT 'monthly',
    status          VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
    auto_renew      BOOLEAN DEFAULT true,
    start_at        TIMESTAMPTZ DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    order_id        VARCHAR(64) REFERENCES orders(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS push_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    msg_type        VARCHAR(16) NOT NULL CHECK (msg_type IN ('morning','night','care','health','achievement','calendar','alert','milestone')),
    title           VARCHAR(128),
    content         TEXT NOT NULL,
    action_url      VARCHAR(512),
    is_read         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_push_messages_user ON push_messages(user_id, is_read, created_at DESC);
CREATE INDEX idx_push_messages_unread ON push_messages(user_id) WHERE is_read = false;

-- 语音消息存储
CREATE TABLE IF NOT EXISTS voice_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    conversation_id UUID REFERENCES conversations(id),
    audio_url       VARCHAR(512) NOT NULL,
    transcript      TEXT,
    duration_ms     INT,
    file_size       INT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
