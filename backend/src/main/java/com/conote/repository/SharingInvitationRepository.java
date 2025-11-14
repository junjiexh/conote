package com.conote.repository;

import com.conote.model.SharingInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SharingInvitationRepository extends JpaRepository<SharingInvitation, UUID> {

    /**
     * Find invitation by token.
     */
    Optional<SharingInvitation> findByInvitationToken(String invitationToken);

    /**
     * Find all invitations for a document.
     */
    List<SharingInvitation> findByDocumentId(UUID documentId);

    /**
     * Find all pending invitations for a document (not accepted and not expired).
     */
    @Query("SELECT i FROM SharingInvitation i WHERE i.documentId = :documentId " +
           "AND i.acceptedAt IS NULL AND i.expiresAt > :now")
    List<SharingInvitation> findPendingByDocumentId(@Param("documentId") UUID documentId, @Param("now") LocalDateTime now);

    /**
     * Find all invitations sent to an email.
     */
    List<SharingInvitation> findByInvitedEmail(String invitedEmail);

    /**
     * Find all pending invitations for a user by email (not accepted and not expired).
     */
    @Query("SELECT i FROM SharingInvitation i WHERE i.invitedEmail = :email " +
           "AND i.acceptedAt IS NULL AND i.expiresAt > :now")
    List<SharingInvitation> findPendingByInvitedEmail(@Param("email") String email, @Param("now") LocalDateTime now);

    /**
     * Find all invitations sent by a user.
     */
    List<SharingInvitation> findByInvitedBy(UUID invitedBy);

    /**
     * Find all expired invitations.
     */
    @Query("SELECT i FROM SharingInvitation i WHERE i.expiresAt < :now AND i.acceptedAt IS NULL")
    List<SharingInvitation> findExpiredInvitations(@Param("now") LocalDateTime now);

    /**
     * Delete all expired invitations (cleanup).
     */
    void deleteByExpiresAtBeforeAndAcceptedAtIsNull(LocalDateTime expiresAt);

    /**
     * Check if an invitation exists for a document and email (to prevent duplicates).
     */
    @Query("SELECT CASE WHEN COUNT(i) > 0 THEN true ELSE false END FROM SharingInvitation i " +
           "WHERE i.documentId = :documentId AND i.invitedEmail = :email " +
           "AND i.acceptedAt IS NULL AND i.expiresAt > :now")
    boolean existsPendingInvitation(@Param("documentId") UUID documentId,
                                   @Param("email") String email,
                                   @Param("now") LocalDateTime now);
}
