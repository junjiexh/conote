package com.conote.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Audit log entity for tracking security-critical operations.
 * Records user actions, authentication events, and security incidents.
 */
@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_user", columnList = "user_id"),
    @Index(name = "idx_audit_event", columnList = "event_type"),
    @Index(name = "idx_audit_timestamp", columnList = "timestamp")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "user_email")
    private String userEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false)
    private AuditEventType eventType;

    @Column(name = "description", nullable = false)
    private String description;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "success", nullable = false)
    private Boolean success;

    @Column(name = "failure_reason")
    private String failureReason;

    @CreationTimestamp
    @Column(name = "timestamp", nullable = false, updatable = false)
    private LocalDateTime timestamp;

    /**
     * Types of auditable security events.
     */
    public enum AuditEventType {
        USER_REGISTRATION,
        USER_LOGIN_SUCCESS,
        USER_LOGIN_FAILURE,
        USER_LOGOUT,
        PASSWORD_CHANGE,
        PASSWORD_RESET_REQUESTED,
        PASSWORD_RESET_COMPLETED,
        ACCOUNT_LOCKED,
        ACCOUNT_UNLOCKED,
        DOCUMENT_CREATED,
        DOCUMENT_UPDATED,
        DOCUMENT_DELETED,
        UNAUTHORIZED_ACCESS_ATTEMPT
    }
}
