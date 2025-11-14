package com.conote.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Represents a pending invitation to share a document with a user.
 * Once accepted, a DocumentPermission record is created.
 */
@Entity
@Table(name = "sharing_invitations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SharingInvitation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * The document being shared.
     */
    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    /**
     * Email address of the invited user.
     */
    @Column(name = "invited_email", nullable = false)
    private String invitedEmail;

    /**
     * User ID if the invited user is registered.
     * Null if inviting someone who doesn't have an account yet.
     */
    @Column(name = "invited_user_id")
    private UUID invitedUserId;

    /**
     * The permission level to grant upon acceptance.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "permission_level", nullable = false)
    private PermissionLevel permissionLevel;

    /**
     * The user who sent the invitation.
     */
    @Column(name = "invited_by", nullable = false)
    private UUID invitedBy;

    /**
     * Unique token for accepting the invitation.
     */
    @Column(name = "invitation_token", nullable = false, unique = true)
    private String invitationToken;

    /**
     * When the invitation expires.
     */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /**
     * When the invitation was accepted.
     * Null if not yet accepted.
     */
    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * Constructor for creating a new invitation.
     */
    public SharingInvitation(UUID documentId, String invitedEmail, UUID invitedUserId,
                            PermissionLevel permissionLevel, UUID invitedBy,
                            String invitationToken, LocalDateTime expiresAt) {
        this.documentId = documentId;
        this.invitedEmail = invitedEmail;
        this.invitedUserId = invitedUserId;
        this.permissionLevel = permissionLevel;
        this.invitedBy = invitedBy;
        this.invitationToken = invitationToken;
        this.expiresAt = expiresAt;
    }

    /**
     * Checks if the invitation has expired.
     */
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    /**
     * Checks if the invitation has been accepted.
     */
    public boolean isAccepted() {
        return acceptedAt != null;
    }

    /**
     * Marks the invitation as accepted.
     */
    public void accept() {
        this.acceptedAt = LocalDateTime.now();
    }
}
