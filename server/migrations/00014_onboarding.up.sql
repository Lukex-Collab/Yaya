-- 新用户引导进度表
CREATE TABLE IF NOT EXISTS onboarding_progress (
    user_id     UUID REFERENCES users(id),
    action_type VARCHAR(32) NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, action_type)
);
