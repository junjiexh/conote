package com.conote.exception;

/**
 * Exception thrown when a user attempts to access a resource they don't have permission for.
 * Results in HTTP 403 Forbidden response.
 */
public class UnauthorizedAccessException extends RuntimeException {

    public UnauthorizedAccessException(String message) {
        super(message);
    }

    public UnauthorizedAccessException(String resourceName, String resourceId) {
        super(String.format("Access denied to %s with id: %s", resourceName, resourceId));
    }
}
