ALTER TABLE documents
    DROP COLUMN IF EXISTS content;

DROP TRIGGER IF EXISTS documents_search_vector_trigger ON documents;
DROP FUNCTION IF EXISTS documents_search_vector_update();

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title
    ON documents
    FOR EACH ROW
    EXECUTE FUNCTION documents_search_vector_update();

CREATE TABLE IF NOT EXISTS document_collab_snapshots (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    snapshot BYTEA NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
