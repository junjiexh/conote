package com.conote.model;

/**
 * User roles for Role-Based Access Control (RBAC).
 */
public enum Role {
    /**
     * Regular user with standard document access.
     */
    USER,

    /**
     * Administrator with elevated privileges.
     * Can manage users, view system metrics, etc.
     */
    ADMIN
}
