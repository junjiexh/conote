-- Create privilege system for document sharing and collaboration
-- Flyway Migration V7

-- Create permission level enum type
CREATE TYPE permission_level AS ENUM ('VIEWER', 'COMMENTER', 'EDITOR');

-- Create document permissions table for sharing
CREATE TABLE IF NOT EXISTS document_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    user_id UUID NOT NULL,
    permission_level permission_level NOT NULL,
    granted_by UUID NOT NULL,
    is_inherited BOOLEAN DEFAULT false,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_permission_document
        FOREIGN KEY(document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_permission_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_permission_grantor
        FOREIGN KEY(granted_by)
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- Ensure unique permission per user per document (direct permissions only)
    -- Inherited permissions are calculated dynamically
    CONSTRAINT unique_user_document_permission
        UNIQUE (document_id, user_id)
);

-- Create indexes for efficient permission lookups
CREATE INDEX IF NOT EXISTS idx_permission_document ON document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_permission_user ON document_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_level ON document_permissions(permission_level);
CREATE INDEX IF NOT EXISTS idx_permission_inherited ON document_permissions(is_inherited);

-- Composite index for permission checks (most common query)
CREATE INDEX IF NOT EXISTS idx_permission_check
    ON document_permissions(user_id, document_id);

-- Index for finding all permissions granted by a user
CREATE INDEX IF NOT EXISTS idx_permission_grantor ON document_permissions(granted_by);

-- Create sharing invitation table for pending invitations
CREATE TABLE IF NOT EXISTS sharing_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    invited_email VARCHAR(255) NOT NULL,
    invited_user_id UUID,
    permission_level permission_level NOT NULL,
    invited_by UUID NOT NULL,
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_invitation_document
        FOREIGN KEY(document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_invitation_user
        FOREIGN KEY(invited_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_invitation_inviter
        FOREIGN KEY(invited_by)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Create indexes for invitation lookups
CREATE INDEX IF NOT EXISTS idx_invitation_email ON sharing_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitation_token ON sharing_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_invitation_document ON sharing_invitations(document_id);
CREATE INDEX IF NOT EXISTS idx_invitation_expires ON sharing_invitations(expires_at);

-- Add comments for documentation
COMMENT ON TABLE document_permissions IS 'Stores explicit permissions for document sharing with inheritance support';
COMMENT ON TABLE sharing_invitations IS 'Stores pending sharing invitations before user accepts';
COMMENT ON COLUMN document_permissions.is_inherited IS 'Marks if permission was inherited from parent (computed field, may not be used)';
COMMENT ON TYPE permission_level IS 'VIEWER: read-only, COMMENTER: read + comment, EDITOR: full edit access';
