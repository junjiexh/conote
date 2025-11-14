package com.conote.dto;

import com.conote.model.PermissionLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Response containing permission information for a document and user.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PermissionResponse {
    private UUID id;
    private UUID documentId;
    private UUID userId;
    private String userEmail;
    private PermissionLevel permissionLevel;
    private UUID grantedBy;
    private String grantedByEmail;
    private boolean isInherited;
    private LocalDateTime grantedAt;
    private LocalDateTime updatedAt;
}
