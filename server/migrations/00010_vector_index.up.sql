-- pgvector ivfflat index for semantic memory search
-- Only useful after >1000 memories inserted;
-- for MVP we create it proactively as data grows.

-- Need to set ivfflat.probes for optimal search
-- Recommended: SET ivfflat.probes = sqrt(row_count) but max 100

-- Create the IVFFlat index for cosine similarity search on memories
-- Skip if fewer than 1000 rows (ivfflat requires training data)
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM memories;
    IF row_count >= 1000 THEN
        -- Drop old index if exists (created manually during dev)
        DROP INDEX IF EXISTS idx_memories_embedding;
        -- Create ivfflat index with 100 lists (sqrt of expected 10k rows)
        CREATE INDEX idx_memories_embedding_ivfflat ON memories
            USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
        RAISE NOTICE 'Created ivfflat index on % rows', row_count;
    ELSE
        RAISE NOTICE 'Skipping ivfflat index: only % rows (need >=1000)', row_count;
    END IF;
END $$;
