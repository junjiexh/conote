package com.conote.controller;

import com.conote.dto.*;
import com.conote.model.PermissionLevel;
import com.conote.service.DocumentService;
import com.conote.service.SharingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Controller for document sharing and permission management.
 */
@RestController
@RequestMapping("/api/sharing")
@Tag(name = "Sharing", description = "Document sharing and collaboration API")
@SecurityRequirement(name = "bearerAuth")
@RequiredArgsConstructor
public class SharingController {

    private final SharingService sharingService;
    private final DocumentService documentService;

    @PostMapping("/share")
    @Operation(
            summary = "Share a document with a user",
            description = "Grant permission to another user to access a document. Only owners and users with EDITOR permission can share documents."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "200",
                    description = "Document shared successfully",
                    content = @Content(schema = @Schema(implementation = PermissionResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "You don't have permission to share this document",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Document or user not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<PermissionResponse> shareDocument(@Valid @RequestBody ShareDocumentRequest request) {
        UUID currentUserId = documentService.getCurrentUserId();
        PermissionResponse response = sharingService.shareDocument(
                request.getDocumentId(),
                request.getEmail(),
                request.getPermissionLevel(),
                currentUserId
        );
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/revoke")
    @Operation(
            summary = "Revoke a user's permission",
            description = "Remove a user's access to a document. Only owners and users with EDITOR permission can revoke access."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "204",
                    description = "Permission revoked successfully"
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "You don't have permission to manage sharing for this document",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Document or permission not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<Void> revokePermission(@Valid @RequestBody RevokePermissionRequest request) {
        UUID currentUserId = documentService.getCurrentUserId();
        sharingService.revokePermission(
                request.getDocumentId(),
                request.getUserId(),
                currentUserId
        );
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/document/{documentId}/collaborators")
    @Operation(
            summary = "Get all collaborators for a document",
            description = "Returns a list of all users who have access to the document, including the owner and users with explicit permissions."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "200",
                    description = "Collaborators retrieved successfully",
                    content = @Content(schema = @Schema(implementation = DocumentCollaboratorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "You don't have permission to view this document's collaborators",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Document not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<List<DocumentCollaboratorResponse>> getDocumentCollaborators(
            @Parameter(description = "Document UUID", required = true)
            @PathVariable UUID documentId) {
        UUID currentUserId = documentService.getCurrentUserId();
        List<DocumentCollaboratorResponse> collaborators = sharingService.getDocumentCollaborators(
                documentId,
                currentUserId
        );
        return ResponseEntity.ok(collaborators);
    }

    @GetMapping("/document/{documentId}/permissions")
    @Operation(
            summary = "Get all permissions for a document",
            description = "Returns a list of all explicit permissions granted for the document (excluding owner)."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "200",
                    description = "Permissions retrieved successfully",
                    content = @Content(schema = @Schema(implementation = PermissionResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Document not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<List<PermissionResponse>> getDocumentPermissions(
            @Parameter(description = "Document UUID", required = true)
            @PathVariable UUID documentId) {
        List<PermissionResponse> permissions = sharingService.getDocumentPermissions(documentId);
        return ResponseEntity.ok(permissions);
    }

    @GetMapping("/document/{documentId}/check-access")
    @Operation(
            summary = "Check user's access level for a document",
            description = "Returns the effective permission level the current user has for a document."
    )
    @ApiResponses(value = {
            @ApiResponse(
                    responseCode = "200",
                    description = "Access level retrieved successfully"
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Document not found or no access",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<PermissionLevel> checkAccess(
            @Parameter(description = "Document UUID", required = true)
            @PathVariable UUID documentId) {
        UUID currentUserId = documentService.getCurrentUserId();
        PermissionLevel permission = sharingService.checkAccess(documentId, currentUserId);
        if (permission == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(permission);
    }
}
