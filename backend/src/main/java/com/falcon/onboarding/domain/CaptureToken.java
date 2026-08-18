package com.falcon.onboarding.domain;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Stores only a one-way hash of the raw token, never the raw value itself -
 * even if this object were ever dumped/leaked, it can't be used to forge a
 * capture link. {@link #tryConsume()} is the single-use guard: the first
 * caller to invoke it wins, and every later call (including concurrent
 * ones) returns false.
 */
public final class CaptureToken {

    private final String tokenHash;
    private final String applicationId;
    private final Instant expiresAt;
    private final AtomicBoolean consumed = new AtomicBoolean(false);

    public CaptureToken(String tokenHash, String applicationId, Instant expiresAt) {
        this(tokenHash, applicationId, expiresAt, false);
    }

    private CaptureToken(String tokenHash, String applicationId, Instant expiresAt, boolean consumed) {
        this.tokenHash = tokenHash;
        this.applicationId = applicationId;
        this.expiresAt = expiresAt;
        this.consumed.set(consumed);
    }

    /** Reconstructs a token from storage. Repository implementations only. */
    public static CaptureToken rehydrate(String tokenHash, String applicationId, Instant expiresAt, boolean consumed) {
        return new CaptureToken(tokenHash, applicationId, expiresAt, consumed);
    }

    public String tokenHash() {
        return tokenHash;
    }

    public String applicationId() {
        return applicationId;
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    public boolean isExpired(Instant now) {
        return now.isAfter(expiresAt);
    }

    public boolean isConsumed() {
        return consumed.get();
    }

    public boolean tryConsume() {
        return consumed.compareAndSet(false, true);
    }
}
