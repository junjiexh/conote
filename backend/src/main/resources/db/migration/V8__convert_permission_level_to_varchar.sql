-- Convert permission_level from custom enum to VARCHAR
-- Flyway Migration V8

-- Convert document_permissions.permission_level to VARCHAR
ALTER TABLE document_permissions
    ALTER COLUMN permission_level TYPE VARCHAR(20) USING permission_level::text;

-- Convert sharing_invitations.permission_level to VARCHAR
ALTER TABLE sharing_invitations
    ALTER COLUMN permission_level TYPE VARCHAR(20) USING permission_level::text;

-- Add CHECK constraint to ensure valid values
ALTER TABLE document_permissions
    ADD CONSTRAINT check_document_permission_level
    CHECK (permission_level IN ('VIEWER', 'COMMENTER', 'EDITOR'));

ALTER TABLE sharing_invitations
    ADD CONSTRAINT check_invitation_permission_level
    CHECK (permission_level IN ('VIEWER', 'COMMENTER', 'EDITOR'));

-- Drop the custom enum type (only works if no other tables use it)
DROP TYPE IF EXISTS permission_level;

-- Add comments
COMMENT ON COLUMN document_permissions.permission_level IS 'Permission level: VIEWER, COMMENTER, or EDITOR (validated by CHECK constraint)';
COMMENT ON COLUMN sharing_invitations.permission_level IS 'Permission level: VIEWER, COMMENTER, or EDITOR (validated by CHECK constraint)';
