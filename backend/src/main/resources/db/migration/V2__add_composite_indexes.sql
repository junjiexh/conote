-- Add composite indexes for performance optimization
-- Flyway Migration V2

-- For filtered tree queries (finding children of parent for specific user)
CREATE INDEX IF NOT EXISTS idx_doc_user_parent ON documents (user_id, parent_id);

-- For sorting and pagination by creation date for specific user
CREATE INDEX IF NOT EXISTS idx_doc_user_created ON documents (user_id, created_at DESC);

-- For sorting and pagination by update date for specific user
CREATE INDEX IF NOT EXISTS idx_doc_user_updated ON documents (user_id, updated_at DESC);
