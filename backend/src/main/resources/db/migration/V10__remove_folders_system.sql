-- Remove folder_id column from documents table
ALTER TABLE documents DROP COLUMN IF EXISTS folder_id;

-- Drop folders table
DROP TABLE IF EXISTS folders;
