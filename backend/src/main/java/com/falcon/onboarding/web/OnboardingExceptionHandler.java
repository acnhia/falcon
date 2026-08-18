package com.falcon.onboarding.web;

import com.falcon.onboarding.domain.IllegalStateTransitionException;
import com.falcon.onboarding.exception.ApplicationNotFoundException;
import com.falcon.onboarding.exception.DocumentStorageException;
import com.falcon.onboarding.exception.DocumentValidationException;
import com.falcon.onboarding.exception.InvalidCaptureLinkException;
import com.falcon.onboarding.exception.TaskValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Own class/package, separate from {@code upload.web.GlobalExceptionHandler}
 * - keeps this feature's exception-to-status mappings colocated with its
 * exceptions and avoids touching upload's file for an unrelated feature.
 */
@RestControllerAdvice
public class OnboardingExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(OnboardingExceptionHandler.class);

    @ExceptionHandler(ApplicationNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleApplicationNotFound(ApplicationNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(InvalidCaptureLinkException.class)
    public ResponseEntity<Map<String, String>> handleInvalidCaptureLink(InvalidCaptureLinkException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(IllegalStateTransitionException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateTransitionException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(DocumentValidationException.class)
    public ResponseEntity<Map<String, String>> handleDocumentValidation(DocumentValidationException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid request: " + e.getMessage()));
    }

    @ExceptionHandler(TaskValidationException.class)
    public ResponseEntity<Map<String, String>> handleTaskValidation(TaskValidationException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(DocumentStorageException.class)
    public ResponseEntity<Map<String, String>> handleStorage(DocumentStorageException e) {
        log.error("Document storage operation failed", e);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", e.getMessage()));
    }
}
