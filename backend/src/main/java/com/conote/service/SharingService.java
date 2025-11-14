package com.conote.service;

import com.conote.dto.DocumentCollaboratorResponse;
import com.conote.dto.PermissionResponse;
import com.conote.exception.BadRequestException;
import com.conote.exception.ForbiddenException;
import com.conote.exception.ResourceNotFoundException;
import com.conote.model.*;
import com.conote.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing document sharing and invitations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SharingService {

    private final PermissionService permissionService;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final SharingInvitationRepository invitationRepository;

    /**
     * Share a document with a user by email.
     * If the user doesn't exist, they can be invited when they sign up.
     *
     * @param documentId The document to share
     * @param email The email of the user to share with
     * @param permissionLevel The permission level to grant
     * @param sharedBy The user sharing the document
     * @return The created permission
     */
    @Transactional
    public PermissionResponse shareDocument(UUID documentId, String email,
                                          PermissionLevel permissionLevel, UUID sharedBy) {
        // Verify document exists
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", documentId));

        // Check if sharer has permission to share
        if (!permissionService.canShare(documentId, sharedBy)) {
            throw new ForbiddenException("You don't have permission to share this document");
        }

        // Find user by email
        User targetUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));

        // Cannot share with yourself
        if (targetUser.getId().equals(sharedBy)) {
            throw new BadRequestException("Cannot share document with yourself");
        }

        // Grant permission
        DocumentPermission permission = permissionService.grantPermission(
                documentId, targetUser.getId(), permissionLevel, sharedBy
        );

        // Build response
        return buildPermissionResponse(permission, targetUser.getEmail(),
                getUserEmail(sharedBy));
    }

    /**
     * Revoke a user's permission for a document.
     *
     * @param documentId The document
     * @param targetUserId The user to revoke permission from
     * @param revokedBy The user revoking the permission
     */
    @Transactional
    public void revokePermission(UUID documentId, UUID targetUserId, UUID revokedBy) {
        permissionService.revokePermission(documentId, targetUserId, revokedBy);
    }

    /**
     * Get all collaborators for a document.
     * Shows who has access and their permission levels.
     *
     * @param documentId The document
     * @param requestingUserId The user requesting the information
     * @return List of collaborators
     */
    public List<DocumentCollaboratorResponse> getDocumentCollaborators(UUID documentId, UUID requestingUserId) {
        // Verify document exists
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", documentId));

        // Check if user has permission to view collaborators
        if (!permissionService.hasPermission(documentId, requestingUserId, PermissionLevel.VIEWER)) {
            throw new ForbiddenException("You don't have permission to view this document's collaborators");
        }

        List<DocumentCollaboratorResponse> collaborators = new ArrayList<>();

        // Add owner
        User owner = userRepository.findById(document.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", document.getUserId()));

        DocumentCollaboratorResponse ownerResponse = new DocumentCollaboratorResponse();
        ownerResponse.setUserId(owner.getId());
        ownerResponse.setEmail(owner.getEmail());
        ownerResponse.setName(owner.getEmail()); // Use email as name for now
        ownerResponse.setPermissionLevel(PermissionLevel.EDITOR); // Owner has full access
        ownerResponse.setIsOwner(true);
        ownerResponse.setIsInherited(false);
        collaborators.add(ownerResponse);

        // Add users with explicit permissions
        List<DocumentPermission> permissions = permissionRepository.findByDocumentId(documentId);
        for (DocumentPermission perm : permissions) {
            User user = userRepository.findById(perm.getUserId()).orElse(null);
            if (user != null) {
                DocumentCollaboratorResponse response = new DocumentCollaboratorResponse();
                response.setUserId(user.getId());
                response.setEmail(user.getEmail());
                response.setName(user.getEmail());
                response.setPermissionLevel(perm.getPermissionLevel());
                response.setIsOwner(false);
                response.setIsInherited(perm.getIsInherited());
                response.setGrantedBy(perm.getGrantedBy());
                response.setGrantedByEmail(getUserEmail(perm.getGrantedBy()));
                response.setGrantedAt(perm.getGrantedAt());
                collaborators.add(response);
            }
        }

        return collaborators;
    }

    /**
     * Get all permissions for a document.
     *
     * @param documentId The document
     * @return List of permissions
     */
    public List<PermissionResponse> getDocumentPermissions(UUID documentId) {
        List<DocumentPermission> permissions = permissionRepository.findByDocumentId(documentId);
        return permissions.stream()
                .map(perm -> buildPermissionResponse(
                        perm,
                        getUserEmail(perm.getUserId()),
                        getUserEmail(perm.getGrantedBy())
                ))
                .collect(Collectors.toList());
    }

    /**
     * Check if a user can access a document.
     *
     * @param documentId The document
     * @param userId The user
     * @return The effective permission level, or null if no access
     */
    public PermissionLevel checkAccess(UUID documentId, UUID userId) {
        return permissionService.getEffectivePermission(documentId, userId);
    }

    /**
     * Helper method to build a PermissionResponse.
     */
    private PermissionResponse buildPermissionResponse(DocumentPermission permission,
                                                       String userEmail, String grantedByEmail) {
        PermissionResponse response = new PermissionResponse();
        response.setId(permission.getId());
        response.setDocumentId(permission.getDocumentId());
        response.setUserId(permission.getUserId());
        response.setUserEmail(userEmail);
        response.setPermissionLevel(permission.getPermissionLevel());
        response.setGrantedBy(permission.getGrantedBy());
        response.setGrantedByEmail(grantedByEmail);
        response.setIsInherited(permission.getIsInherited());
        response.setGrantedAt(permission.getGrantedAt());
        response.setUpdatedAt(permission.getUpdatedAt());
        return response;
    }

    /**
     * Helper method to get user email by ID.
     */
    private String getUserEmail(UUID userId) {
        return userRepository.findById(userId)
                .map(User::getEmail)
                .orElse("Unknown");
    }
}
