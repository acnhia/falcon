package com.falcon.onboarding.exception;

/**
 * Thrown for every "not found", "expired", and "already consumed" capture
 * token - deliberately never told apart, and this message is the only one
 * ever shown, so a caller cannot use error content to enumerate which kind
 * of invalid a token was.
 */
public class InvalidCaptureLinkException extends RuntimeException {

    private static final String GENERIC_MESSAGE = "This capture link is invalid or has expired.";

    public InvalidCaptureLinkException() {
        super(GENERIC_MESSAGE);
    }
}
