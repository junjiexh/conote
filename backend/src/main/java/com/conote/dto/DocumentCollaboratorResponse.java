package com.conote.dto;

import com.conote.model.PermissionLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Response containing information about a collaborator on a document.
 * Shows who has access and why (owner, explicit permission, or inherited).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentCollaboratorResponse {
    private UUID userId;
    private String email;
    private String name;
    private PermissionLevel permissionLevel;
    private boolean isOwner;
    private boolean isInherited;
    private String inheritedFrom; // Document title if inherited
    private UUID grantedBy;
    private String grantedByEmail;
    private LocalDateTime grantedAt;
}
