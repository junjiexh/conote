package com.conote.repository;

import com.conote.model.DocumentPermission;
import com.conote.model.PermissionLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentPermissionRepository extends JpaRepository<DocumentPermission, UUID> {

    /**
     * Find permission for a specific user and document.
     */
    Optional<DocumentPermission> findByDocumentIdAndUserId(UUID documentId, UUID userId);

    /**
     * Find all permissions for a document.
     */
    List<DocumentPermission> findByDocumentId(UUID documentId);

    /**
     * Find all permissions granted to a user.
     */
    List<DocumentPermission> findByUserId(UUID userId);

    /**
     * Find all permissions granted by a specific user.
     */
    List<DocumentPermission> findByGrantedBy(UUID grantedBy);

    /**
     * Find all permissions for multiple documents (batch query).
     */
    List<DocumentPermission> findByDocumentIdIn(List<UUID> documentIds);

    /**
     * Find all permissions for a user on multiple documents.
     */
    @Query("SELECT p FROM DocumentPermission p WHERE p.userId = :userId AND p.documentId IN :documentIds")
    List<DocumentPermission> findByUserIdAndDocumentIdIn(@Param("userId") UUID userId, @Param("documentIds") List<UUID> documentIds);

    /**
     * Delete permission for a specific user and document.
     */
    void deleteByDocumentIdAndUserId(UUID documentId, UUID userId);

    /**
     * Delete all permissions for a document.
     */
    void deleteByDocumentId(UUID documentId);

    /**
     * Check if a user has any permission on a document.
     */
    boolean existsByDocumentIdAndUserId(UUID documentId, UUID userId);

    /**
     * Count permissions for a document.
     */
    long countByDocumentId(UUID documentId);

    /**
     * Find all users with a specific permission level on a document.
     */
    List<DocumentPermission> findByDocumentIdAndPermissionLevel(UUID documentId, PermissionLevel permissionLevel);
}
