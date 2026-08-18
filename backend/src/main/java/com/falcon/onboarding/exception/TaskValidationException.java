package com.falcon.onboarding.exception;

/** Thrown by a {@code BaseTask}'s {@code validate()} hook. */
public class TaskValidationException extends RuntimeException {
    public TaskValidationException(String message) {
        super(message);
    }
}
