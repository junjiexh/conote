package com.conote.service;

import com.conote.model.AuditLog;
import com.conote.model.User;
import com.conote.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Service for recording and querying security audit logs.
 * All logging operations are async to avoid blocking main operations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Record a successful security event.
     * Executed asynchronously to avoid blocking main thread.
     *
     * @param userId the user ID
     * @param userEmail the user email
     * @param eventType the event type
     * @param description the event description
     * @param ipAddress the client IP address
     * @param userAgent the client user agent
     */
    @Async
    @Transactional
    public void logSuccess(
        UUID userId,
        String userEmail,
        AuditLog.AuditEventType eventType,
        String description,
        String ipAddress,
        String userAgent
    ) {
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setUserId(userId);
            auditLog.setUserEmail(userEmail);
            auditLog.setEventType(eventType);
            auditLog.setDescription(description);
            auditLog.setIpAddress(ipAddress);
            auditLog.setUserAgent(userAgent);
            auditLog.setSuccess(true);

            auditLogRepository.save(auditLog);
            log.debug("Audit log recorded: {} for user {}", eventType, userEmail);
        } catch (Exception e) {
            // Don't throw exception to avoid breaking main flow
            log.error("Failed to record audit log: {}", e.getMessage(), e);
        }
    }

    /**
     * Record a failed security event.
     * Executed asynchronously to avoid blocking main thread.
     *
     * @param userId the user ID (can be null if user not found)
     * @param userEmail the user email
     * @param eventType the event type
     * @param description the event description
     * @param failureReason the reason for failure
     * @param ipAddress the client IP address
     * @param userAgent the client user agent
     */
    @Async
    @Transactional
    public void logFailure(
        UUID userId,
        String userEmail,
        AuditLog.AuditEventType eventType,
        String description,
        String failureReason,
        String ipAddress,
        String userAgent
    ) {
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setUserId(userId);
            auditLog.setUserEmail(userEmail);
            auditLog.setEventType(eventType);
            auditLog.setDescription(description);
            auditLog.setFailureReason(failureReason);
            auditLog.setIpAddress(ipAddress);
            auditLog.setUserAgent(userAgent);
            auditLog.setSuccess(false);

            auditLogRepository.save(auditLog);
            log.warn("Audit log recorded: {} FAILED for user {} - Reason: {}", eventType, userEmail, failureReason);
        } catch (Exception e) {
            // Don't throw exception to avoid breaking main flow
            log.error("Failed to record audit log: {}", e.getMessage(), e);
        }
    }

    /**
     * Convenience method for logging user-related events.
     */
    @Async
    @Transactional
    public void logUserEvent(
        User user,
        AuditLog.AuditEventType eventType,
        String description,
        boolean success,
        String failureReason
    ) {
        if (success) {
            logSuccess(user.getId(), user.getEmail(), eventType, description, null, null);
        } else {
            logFailure(user.getId(), user.getEmail(), eventType, description, failureReason, null, null);
        }
    }

    /**
     * Get audit logs for a specific user with pagination.
     */
    @Transactional(readOnly = true)
    public Page<AuditLog> getUserAuditLogs(UUID userId, Pageable pageable) {
        return auditLogRepository.findByUserIdOrderByTimestampDesc(userId, pageable);
    }

    /**
     * Count recent failed login attempts for a user.
     * Useful for detecting brute force attacks.
     */
    @Transactional(readOnly = true)
    public long countRecentFailedLogins(UUID userId, int minutesBack) {
        LocalDateTime since = LocalDateTime.now().minusMinutes(minutesBack);
        return auditLogRepository.countByUserIdAndEventTypeAndSuccessFalseAndTimestampAfter(
            userId,
            AuditLog.AuditEventType.USER_LOGIN_FAILURE,
            since
        );
    }
}
