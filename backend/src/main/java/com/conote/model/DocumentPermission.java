package com.conote.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Represents an explicit permission granted to a user for a specific document.
 * Permissions can be inherited from parent documents or explicitly set.
 */
@Entity
@Table(name = "document_permissions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentPermission {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * The document this permission applies to.
     */
    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    /**
     * The user who is granted this permission.
     */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /**
     * The level of permission granted.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "permission_level", nullable = false)
    private PermissionLevel permissionLevel;

    /**
     * The user who granted this permission.
     * Typically the document owner or another user with EDITOR access.
     */
    @Column(name = "granted_by", nullable = false)
    private UUID grantedBy;

    /**
     * Whether this permission is inherited from a parent document.
     * Note: For now, we'll calculate inheritance dynamically rather than storing it.
     * This field exists for potential future optimization.
     */
    @Column(name = "is_inherited", nullable = false)
    private Boolean isInherited = false;

    @CreationTimestamp
    @Column(name = "granted_at", nullable = false, updatable = false)
    private LocalDateTime grantedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * Constructor for creating a new explicit permission.
     */
    public DocumentPermission(UUID documentId, UUID userId, PermissionLevel permissionLevel, UUID grantedBy) {
        this.documentId = documentId;
        this.userId = userId;
        this.permissionLevel = permissionLevel;
        this.grantedBy = grantedBy;
        this.isInherited = false;
    }
}
