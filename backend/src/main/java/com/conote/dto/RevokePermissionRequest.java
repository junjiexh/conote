package com.conote.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Request to revoke a user's permission for a document.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RevokePermissionRequest {
    @NotNull(message = "Document ID is required")
    private UUID documentId;

    @NotNull(message = "User ID is required")
    private UUID userId;
}
