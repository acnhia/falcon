package com.falcon.onboarding.exception;

public class ApplicationNotFoundException extends RuntimeException {
    public ApplicationNotFoundException(String publicReference) {
        super("No onboarding application found for reference " + publicReference);
    }
}
