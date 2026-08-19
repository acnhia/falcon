package com.falcon.onboarding.exception;

/** Thrown when a task name isn't in the {@code TaskRegistry}'s allowlist. */
public class UnknownTaskException extends RuntimeException {
    public UnknownTaskException(String taskName) {
        super("Unknown task: " + taskName);
    }
}
