CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    title           VARCHAR(128),
    mood            VARCHAR(16),
    message_count   INT DEFAULT 0,
    started_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    ended_at        TIMESTAMPTZ
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) NOT NULL,
    role            VARCHAR(8) NOT NULL CHECK (role IN ('user','assistant')),
    content         TEXT NOT NULL,
    emotion         VARCHAR(16),
    tokens_in       INT,
    tokens_out      INT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX idx_conversations_user ON conversations(user_id, started_at DESC);
