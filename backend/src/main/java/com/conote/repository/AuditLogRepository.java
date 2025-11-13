package com.conote.repository;

import com.conote.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Repository for audit log operations.
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    /**
     * Find all audit logs for a specific user.
     */
    Page<AuditLog> findByUserIdOrderByTimestampDesc(UUID userId, Pageable pageable);

    /**
     * Find audit logs by event type.
     */
    List<AuditLog> findByEventTypeOrderByTimestampDesc(AuditLog.AuditEventType eventType);

    /**
     * Find failed events within a time range.
     */
    List<AuditLog> findBySuccessFalseAndTimestampBetween(LocalDateTime start, LocalDateTime end);

    /**
     * Count failed login attempts for a user within a time range.
     */
    long countByUserIdAndEventTypeAndSuccessFalseAndTimestampAfter(
        UUID userId,
        AuditLog.AuditEventType eventType,
        LocalDateTime since
    );
}
