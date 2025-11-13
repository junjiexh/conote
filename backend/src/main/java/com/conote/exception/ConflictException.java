package com.conote.exception;

/**
 * Exception thrown when a request conflicts with current state of the resource.
 * Results in HTTP 409 Conflict response.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }

    public ConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}
