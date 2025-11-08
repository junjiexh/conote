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
    content TEXT, -- The actual text content of the document
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_doc_user_id ON documents (user_id);
CREATE INDEX IF NOT EXISTS idx_doc_parent_id ON documents (parent_id);
