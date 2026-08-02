CREATE TABLE period_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE,
    cycle_length    SMALLINT,
    symptoms        VARCHAR(64)[] DEFAULT '{}',
    mood_note       VARCHAR(256),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE body_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    note_type       VARCHAR(32) NOT NULL,
    detail          VARCHAR(512),
    severity        SMALLINT CHECK (severity BETWEEN 1 AND 5),
    created_at      DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_period_user ON period_records(user_id, start_date DESC);
CREATE INDEX idx_body_notes_user ON body_notes(user_id, created_at DESC);
