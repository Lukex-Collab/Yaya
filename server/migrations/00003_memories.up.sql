CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    content         TEXT NOT NULL,
    summary         VARCHAR(256),
    embedding       vector(1536),
    importance      SMALLINT DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
    memory_type     VARCHAR(16) DEFAULT 'episodic'
                    CHECK (memory_type IN ('episodic','semantic','core_fact')),
    source_msg_id   UUID REFERENCES messages(id),
    decay_factor    REAL DEFAULT 1.0,
    access_count    INT DEFAULT 0,
    last_accessed   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_memories_user ON memories(user_id, memory_type);

CREATE TABLE core_facts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    key             VARCHAR(64) NOT NULL,
    value           TEXT NOT NULL,
    confidence      REAL DEFAULT 1.0,
    source_msg_id   UUID REFERENCES messages(id),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, key)
);
