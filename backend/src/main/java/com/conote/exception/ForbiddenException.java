package com.conote.exception;

/**
 * Exception thrown when a user lacks permission to perform an action.
 * Results in HTTP 403 Forbidden response.
 * This is used specifically for permission-based access control.
 */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }

    public ForbiddenException(String resourceName, String action) {
        super(String.format("You don't have permission to %s this %s", action, resourceName));
    }
}
