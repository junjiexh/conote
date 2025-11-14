package com.conote.dto;

import com.conote.model.PermissionLevel;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Request to share a document with another user.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShareDocumentRequest {
    @NotNull(message = "Document ID is required")
    private UUID documentId;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotNull(message = "Permission level is required")
    private PermissionLevel permissionLevel;
}
