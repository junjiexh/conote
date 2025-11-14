package com.conote.service;

import com.conote.exception.ForbiddenException;
import com.conote.exception.ResourceNotFoundException;
import com.conote.model.Document;
import com.conote.model.DocumentPermission;
import com.conote.model.PermissionLevel;
import com.conote.repository.DocumentPermissionRepository;
import com.conote.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Service for managing document permissions and access control.
 * Implements permission inheritance and the "strongest permission wins" rule.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PermissionService {

    private final DocumentPermissionRepository permissionRepository;
    private final DocumentRepository documentRepository;

    /**
     * Check if a user has at least the specified permission level on a document.
     * Considers ownership, explicit permissions, and inherited permissions from parent documents.
     *
     * @param documentId The document to check
     * @param userId The user to check
     * @param requiredLevel The minimum required permission level
     * @return true if the user has sufficient permission
     */
    public boolean hasPermission(UUID documentId, UUID userId, PermissionLevel requiredLevel) {
        PermissionLevel effectivePermission = getEffectivePermission(documentId, userId);
        return effectivePermission != null && effectivePermission.isStrongerThanOrEqual(requiredLevel);
    }

    /**
     * Check if a user is the owner of a document.
     *
     * @param documentId The document to check
     * @param userId The user to check
     * @return true if the user owns the document
     */
    public boolean isOwner(UUID documentId, UUID userId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", documentId));
        return document.getUserId().equals(userId);
    }

    /**
     * Get the effective permission level for a user on a document.
     * This considers:
     * 1. Ownership (implicit full access)
     * 2. Explicit permissions on the document
     * 3. Inherited permissions from parent documents (strongest wins)
     *
     * @param documentId The document to check
     * @param userId The user to check
     * @return The effective permission level, or null if no access
     */
    public PermissionLevel getEffectivePermission(UUID documentId, UUID userId) {
        // Owner has implicit EDITOR access (highest level)
        if (isOwner(documentId, userId)) {
            return PermissionLevel.EDITOR;
        }

        // Check for explicit permission on this document
        Optional<DocumentPermission> explicitPermission =
            permissionRepository.findByDocumentIdAndUserId(documentId, userId);

        // Get inherited permissions from parent documents
        PermissionLevel inheritedPermission = getInheritedPermission(documentId, userId);

        // Apply "strongest permission wins" rule
        if (explicitPermission.isPresent() && inheritedPermission != null) {
            PermissionLevel explicit = explicitPermission.get().getPermissionLevel();
            return explicit.isStrongerThanOrEqual(inheritedPermission) ? explicit : inheritedPermission;
        } else if (explicitPermission.isPresent()) {
            return explicitPermission.get().getPermissionLevel();
        } else {
            return inheritedPermission;
        }
    }

    /**
     * Get inherited permission from parent documents.
     * Traverses up the document tree to find the strongest inherited permission.
     *
     * @param documentId The document to check
     * @param userId The user to check
     * @return The inherited permission level, or null if no inherited permission
     */
    private PermissionLevel getInheritedPermission(UUID documentId, UUID userId) {
        Document document = documentRepository.findById(documentId).orElse(null);
        if (document == null || document.getParentId() == null) {
            return null;
        }

        PermissionLevel strongestInherited = null;
        UUID currentParentId = document.getParentId();
        Set<UUID> visited = new HashSet<>(); // Prevent infinite loops

        // Traverse up the document tree
        while (currentParentId != null && !visited.contains(currentParentId)) {
            visited.add(currentParentId);

            // Check if user has explicit permission on this parent
            Optional<DocumentPermission> parentPermission =
                permissionRepository.findByDocumentIdAndUserId(currentParentId, userId);

            if (parentPermission.isPresent()) {
                PermissionLevel parentLevel = parentPermission.get().getPermissionLevel();
                if (strongestInherited == null || parentLevel.isStrongerThanOrEqual(strongestInherited)) {
                    strongestInherited = parentLevel;
                }
            }

            // Check if user is owner of parent (implicit EDITOR)
            Document parent = documentRepository.findById(currentParentId).orElse(null);
            if (parent != null && parent.getUserId().equals(userId)) {
                strongestInherited = PermissionLevel.EDITOR; // Owner has highest permission
                break; // No need to go further, EDITOR is the highest
            }

            // Move to next parent
            currentParentId = parent != null ? parent.getParentId() : null;
        }

        return strongestInherited;
    }

    /**
     * Grant permission to a user for a document.
     * Only owners or users with EDITOR permission can grant permissions.
     *
     * @param documentId The document to share
     * @param targetUserId The user to grant permission to
     * @param permissionLevel The permission level to grant
     * @param grantedBy The user granting the permission
     * @throws ForbiddenException if the grantor doesn't have permission to share
     */
    @Transactional
    public DocumentPermission grantPermission(UUID documentId, UUID targetUserId,
                                             PermissionLevel permissionLevel, UUID grantedBy) {
        // Verify the document exists
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", documentId));

        // Check if the grantor has permission to share
        if (!isOwner(documentId, grantedBy) && !hasPermission(documentId, grantedBy, PermissionLevel.EDITOR)) {
            throw new ForbiddenException("You don't have permission to share this document");
        }

        // Check if user is trying to grant permission to themselves
        if (targetUserId.equals(grantedBy)) {
            throw new IllegalArgumentException("Cannot grant permission to yourself");
        }

        // Check if user is trying to grant permission to the owner
        if (isOwner(documentId, targetUserId)) {
            throw new IllegalArgumentException("Cannot grant permission to the document owner");
        }

        // Check if permission already exists
        Optional<DocumentPermission> existing =
            permissionRepository.findByDocumentIdAndUserId(documentId, targetUserId);

        if (existing.isPresent()) {
            // Update existing permission
            DocumentPermission permission = existing.get();
            permission.setPermissionLevel(permissionLevel);
            permission.setGrantedBy(grantedBy);
            log.info("Updated permission for user {} on document {} to {}",
                    targetUserId, documentId, permissionLevel);
            return permissionRepository.save(permission);
        } else {
            // Create new permission
            DocumentPermission permission = new DocumentPermission(
                documentId, targetUserId, permissionLevel, grantedBy
            );
            log.info("Granted {} permission to user {} on document {}",
                    permissionLevel, targetUserId, documentId);
            return permissionRepository.save(permission);
        }
    }

    /**
     * Revoke permission from a user for a document.
     * Only owners or users with EDITOR permission can revoke permissions.
     *
     * @param documentId The document
     * @param targetUserId The user to revoke permission from
     * @param revokedBy The user revoking the permission
     * @throws ForbiddenException if the revoker doesn't have permission
     */
    @Transactional
    public void revokePermission(UUID documentId, UUID targetUserId, UUID revokedBy) {
        // Verify the document exists
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", documentId));

        // Check if the revoker has permission to manage sharing
        if (!isOwner(documentId, revokedBy) && !hasPermission(documentId, revokedBy, PermissionLevel.EDITOR)) {
            throw new ForbiddenException("You don't have permission to manage sharing for this document");
        }

        // Cannot revoke permission from the owner
        if (isOwner(documentId, targetUserId)) {
            throw new IllegalArgumentException("Cannot revoke permission from the document owner");
        }

        // Delete the permission if it exists
        permissionRepository.deleteByDocumentIdAndUserId(documentId, targetUserId);
        log.info("Revoked permission from user {} on document {}", targetUserId, documentId);
    }

    /**
     * Get all users who have access to a document (explicit permissions only).
     *
     * @param documentId The document
     * @return List of permissions for the document
     */
    public List<DocumentPermission> getDocumentPermissions(UUID documentId) {
        return permissionRepository.findByDocumentId(documentId);
    }

    /**
     * Get all documents that a user has explicit permission to access (not owned by them).
     *
     * @param userId The user
     * @return List of permissions granted to the user
     */
    public List<DocumentPermission> getUserPermissions(UUID userId) {
        return permissionRepository.findByUserId(userId);
    }

    /**
     * Check if a user can share a document.
     * Only owners and users with EDITOR permission can share.
     *
     * @param documentId The document
     * @param userId The user
     * @return true if the user can share the document
     */
    public boolean canShare(UUID documentId, UUID userId) {
        return isOwner(documentId, userId) || hasPermission(documentId, userId, PermissionLevel.EDITOR);
    }

    /**
     * Require that a user has at least the specified permission level.
     * Throws ForbiddenException if they don't.
     *
     * @param documentId The document
     * @param userId The user
     * @param requiredLevel The required permission level
     * @throws ForbiddenException if permission is insufficient
     */
    public void requirePermission(UUID documentId, UUID userId, PermissionLevel requiredLevel) {
        if (!hasPermission(documentId, userId, requiredLevel)) {
            throw new ForbiddenException("You don't have sufficient permission to access this document");
        }
    }

    /**
     * Get all documents a user can access (owned + shared with them).
     * Returns document IDs and their effective permission levels.
     *
     * @param userId The user
     * @return Map of document ID to effective permission level
     */
    public Map<UUID, PermissionLevel> getAccessibleDocuments(UUID userId) {
        Map<UUID, PermissionLevel> accessible = new HashMap<>();

        // Add all documents owned by the user (EDITOR permission)
        List<Document> ownedDocuments = documentRepository.findByUserId(userId);
        for (Document doc : ownedDocuments) {
            accessible.put(doc.getId(), PermissionLevel.EDITOR);
        }

        // Add all documents explicitly shared with the user
        List<DocumentPermission> permissions = permissionRepository.findByUserId(userId);
        for (DocumentPermission perm : permissions) {
            accessible.put(perm.getDocumentId(), perm.getPermissionLevel());
        }

        return accessible;
    }
}
