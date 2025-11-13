-- Remove PostgreSQL full-text search infrastructure in favor of Elasticsearch
-- This migration removes the trigger, function, index, and column added in V3

-- Drop the trigger
DROP TRIGGER IF EXISTS documents_search_vector_trigger ON documents;

-- Drop the function
DROP FUNCTION IF EXISTS documents_search_vector_update();

-- Drop the GIN index
DROP INDEX IF EXISTS idx_doc_search;

-- Drop the search_vector column
ALTER TABLE documents DROP COLUMN IF EXISTS search_vector;
