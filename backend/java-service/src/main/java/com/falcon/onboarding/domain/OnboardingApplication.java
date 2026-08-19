package com.falcon.onboarding.domain;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Aggregate root for one synthetic onboarding application, mirroring
 * {@code upload.domain.UploadSession}'s concurrency split:
 *
 * <ul>
 *   <li>{@link #documents} is a {@link ConcurrentHashMap} - front and back
 *       uploads may race from different requests, but each side is written
 *       at most meaningfully once, so no external locking is needed for the
 *       map itself.</li>
 *   <li>{@link #validationTriggered} is an {@link AtomicBoolean} guarded by
 *       compareAndSet so exactly one caller ever wins the race to invoke the
 *       mock validator, even if front and back complete on different
 *       threads at nearly the same instant.</li>
 *   <li>{@link #state} transitions go through {@code synchronized} methods
 *       because state changes are rare and must be strictly ordered, unlike
 *       document uploads, which are independent of each other.</li>
 * </ul>
 */
public final class OnboardingApplication {

    private final String id;
    private final String publicReference;
    private final Instant createdAt;

    private final Map<DocumentSide, DocumentRecord> documents;
    private final AtomicBoolean validationTriggered;

    private volatile OnboardingState state;

    public OnboardingApplication(String id, String publicReference) {
        this.id = id;
        this.publicReference = publicReference;
        this.createdAt = Instant.now();
        this.documents = new ConcurrentHashMap<>();
        this.validationTriggered = new AtomicBoolean(false);
        this.state = new DraftState();
    }

    private OnboardingApplication(
            String id, String publicReference, Instant createdAt,
            Map<DocumentSide, DocumentRecord> documents, boolean validationTriggered, OnboardingStatus status) {
        this.id = id;
        this.publicReference = publicReference;
        this.createdAt = createdAt;
        this.documents = new ConcurrentHashMap<>(documents);
        this.validationTriggered = new AtomicBoolean(validationTriggered);
        this.state = OnboardingState.forStatus(status);
    }

    /**
     * Reconstructs an application from storage, bypassing transition validation -
     * the persisted status is trusted as-is. Repository implementations only.
     */
    public static OnboardingApplication rehydrate(
            String id, String publicReference, Instant createdAt,
            Map<DocumentSide, DocumentRecord> documents, boolean validationTriggered, OnboardingStatus status) {
        return new OnboardingApplication(id, publicReference, createdAt, documents, validationTriggered, status);
    }

    public String id() {
        return id;
    }

    public String publicReference() {
        return publicReference;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public OnboardingStatus status() {
        return state.status();
    }

    public Collection<DocumentRecord> documents() {
        return documents.values();
    }

    public boolean isValidationTriggered() {
        return validationTriggered.get();
    }

    public boolean hasBothSides() {
        return documents.containsKey(DocumentSide.FRONT) && documents.containsKey(DocumentSide.BACK);
    }

    public void recordDocument(DocumentSide side, DocumentRecord record) {
        documents.put(side, record);
    }

    public synchronized void markCaptureLinkIssued() {
        state = state.onCaptureLinkIssued(this);
    }

    /**
     * Atomically claims the right to run mock validation, if (and only if)
     * both sides are present and nobody has claimed it yet. Returns true
     * exactly once, to the single caller that should invoke the validator.
     */
    public synchronized boolean claimValidationIfReady() {
        if (hasBothSides() && validationTriggered.compareAndSet(false, true)) {
            state = state.onDocumentsCaptured(this);
            return true;
        }
        return false;
    }

    public synchronized void markValidated(ValidationResult result) {
        state = state.onValidated(this, result);
    }

    public synchronized void markReadyForReview() {
        state = state.onReadyForReview(this);
    }
}
