package com.conote.model;

/**
 * Permission levels for document sharing and collaboration.
 * Permissions flow down the document tree (inheritance).
 */
public enum PermissionLevel {
    /**
     * VIEWER: Read-only access.
     * Can view document content but cannot edit or comment.
     */
    VIEWER,

    /**
     * COMMENTER: Read + Comment access.
     * Can view document content and add/reply to comments.
     * Cannot edit document content.
     */
    COMMENTER,

    /**
     * EDITOR: Full edit access.
     * Can view, comment, and modify document content.
     * Can create child documents under documents they have EDITOR access to.
     * May share documents at their permission level or lower (policy decision).
     */
    EDITOR;

    /**
     * Checks if this permission level is stronger than or equal to another.
     * Used for the "strongest permission wins" rule.
     *
     * @param other The permission level to compare against
     * @return true if this permission is stronger or equal
     */
    public boolean isStrongerThanOrEqual(PermissionLevel other) {
        return this.ordinal() >= other.ordinal();
    }

    /**
     * Checks if this permission allows editing.
     *
     * @return true if EDITOR level
     */
    public boolean canEdit() {
        return this == EDITOR;
    }

    /**
     * Checks if this permission allows commenting.
     *
     * @return true if COMMENTER or EDITOR level
     */
    public boolean canComment() {
        return this == COMMENTER || this == EDITOR;
    }

    /**
     * Checks if this permission allows viewing.
     * All permission levels allow viewing.
     *
     * @return true for all levels
     */
    public boolean canView() {
        return true;
    }
}
