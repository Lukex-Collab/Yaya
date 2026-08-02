CREATE TABLE safety_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    event_type      VARCHAR(32) NOT NULL,
    device_id       VARCHAR(64),
    detail          JSONB,
    is_simulated    BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_safety_user ON safety_logs(user_id, created_at DESC);
