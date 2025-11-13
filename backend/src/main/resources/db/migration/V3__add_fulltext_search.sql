-- Add full-text search support with PostgreSQL tsvector
-- Flyway Migration V3

-- Add tsvector column for full-text search
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for full-text search performance
CREATE INDEX IF NOT EXISTS idx_doc_search ON documents USING GIN (search_vector);

-- Function to update search_vector automatically
CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to keep search_vector updated
DROP TRIGGER IF EXISTS documents_search_vector_trigger ON documents;
CREATE TRIGGER documents_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, content
    ON documents
    FOR EACH ROW
    EXECUTE FUNCTION documents_search_vector_update();

-- Populate search_vector for existing documents
UPDATE documents SET search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'B');
