package com.falcon.upload.exception;

public class SessionNotFoundException extends RuntimeException {
    public SessionNotFoundException(String sessionId) {
        super("No upload session found for id " + sessionId);
    }
}
