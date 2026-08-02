CREATE TABLE achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(32) UNIQUE NOT NULL,
    name            VARCHAR(64) NOT NULL,
    description     VARCHAR(256),
    icon_emoji      VARCHAR(8),
    category        VARCHAR(16) CHECK (category IN ('milestone','social','emotion','special')),
    tier            SMALLINT DEFAULT 1
);

CREATE TABLE user_achievements (
    user_id         UUID REFERENCES users(id) NOT NULL,
    achievement_id  UUID REFERENCES achievements(id) NOT NULL,
    progress        INT DEFAULT 0,
    target          INT NOT NULL,
    unlocked_at     TIMESTAMPTZ,
    is_notified     BOOLEAN DEFAULT false,
    PRIMARY KEY (user_id, achievement_id)
);
