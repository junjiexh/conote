-- Folder categorization system
-- Flyway Migration V8

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_folder_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- Ensure unique folder names per user
    CONSTRAINT unique_folder_name_per_user UNIQUE(user_id, name)
);

-- Create index for faster folder lookups by user
CREATE INDEX idx_folder_user_id ON folders (user_id);

-- Add folder_id column to documents table
ALTER TABLE documents
ADD COLUMN folder_id UUID;

-- Add foreign key constraint for folder_id
ALTER TABLE documents
ADD CONSTRAINT fk_document_folder
    FOREIGN KEY(folder_id)
    REFERENCES folders(id)
    ON DELETE SET NULL;

-- Create index for faster document lookups by folder
CREATE INDEX idx_doc_folder_id ON documents (folder_id);

-- Create default "personal" folder for all existing users
INSERT INTO folders (user_id, name)
SELECT id, 'personal' FROM users;

-- Assign all existing documents to their owner's "personal" folder
UPDATE documents d
SET folder_id = f.id
FROM folders f
WHERE d.user_id = f.user_id
AND f.name = 'personal';
