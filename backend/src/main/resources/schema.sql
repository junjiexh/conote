-- Database Schema for Conote Document Editor

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    parent_id UUID, -- Can be NULL for root-level documents
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Foreign key to link documents to their owner
    CONSTRAINT fk_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE, -- If user is deleted, delete their docs

    -- Foreign key for the self-referencing tree structure
    CONSTRAINT fk_parent
        FOREIGN KEY(parent_id)
        REFERENCES documents(id)
        ON DELETE SET NULL -- Or ON DELETE CASCADE, based on desired behavior
);

-- Single-column indexes for basic queries
CREATE INDEX IF NOT EXISTS idx_doc_user_id ON documents (user_id);
CREATE INDEX IF NOT EXISTS idx_doc_parent_id ON documents (parent_id);

-- Composite indexes for optimized queries
-- For filtered tree queries (finding children of parent for specific user)
CREATE INDEX IF NOT EXISTS idx_doc_user_parent ON documents (user_id, parent_id);

-- For sorting and pagination by creation date for specific user
CREATE INDEX IF NOT EXISTS idx_doc_user_created ON documents (user_id, created_at DESC);

-- For sorting and pagination by update date for specific user
CREATE INDEX IF NOT EXISTS idx_doc_user_updated ON documents (user_id, updated_at DESC);

-- Full-text search indexes (for advanced search functionality)
-- Add tsvector column for full-text search on title and content
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for full-text search performance
CREATE INDEX IF NOT EXISTS idx_doc_search ON documents USING GIN (search_vector);

-- Function to update search_vector automatically
CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to keep search_vector updated
DROP TRIGGER IF EXISTS documents_search_vector_trigger ON documents;
CREATE TRIGGER documents_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title
    ON documents
    FOR EACH ROW
    EXECUTE FUNCTION documents_search_vector_update();

-- Collaborative snapshot storage
CREATE TABLE IF NOT EXISTS document_collab_snapshots (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    snapshot BYTEA NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
