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
CREATE INDEX IF NOT EXISTS idx_folder_user_id ON folders (user_id);

-- Add folder_id column to documents table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'folder_id'
    ) THEN
        ALTER TABLE documents ADD COLUMN folder_id UUID;
    END IF;
END $$;

-- Add foreign key constraint for folder_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_folder'
    ) THEN
        ALTER TABLE documents
        ADD CONSTRAINT fk_document_folder
            FOREIGN KEY(folder_id)
            REFERENCES folders(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for faster document lookups by folder
CREATE INDEX IF NOT EXISTS idx_doc_folder_id ON documents (folder_id);

-- Create default "personal" folder for all existing users (only if they don't have one)
INSERT INTO folders (user_id, name)
SELECT u.id, 'personal'
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM folders f
    WHERE f.user_id = u.id AND f.name = 'personal'
);

-- Assign all existing documents to their owner's "personal" folder (only if not already assigned)
UPDATE documents d
SET folder_id = f.id
FROM folders f
WHERE d.user_id = f.user_id
AND f.name = 'personal'
AND d.folder_id IS NULL;
