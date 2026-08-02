CREATE TABLE journals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    title           VARCHAR(256),
    content         TEXT NOT NULL,
    emotion         VARCHAR(16),
    emotion_score   REAL,
    weather         VARCHAR(16),
    linked_memories UUID[] DEFAULT '{}',
    is_private      BOOLEAN DEFAULT false,
    word_count      INT,
    created_at      DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_journals_user_date ON journals(user_id, created_at DESC);
