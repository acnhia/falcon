package com.falcon.upload.domain;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Aggregate root for one multipart upload. Parts arrive concurrently from
 * multiple HTTP request threads (one per part-upload worker), so the
 * mutable pieces are chosen for concurrent access rather than locked as a
 * whole:
 *
 * <ul>
 *   <li>{@link #parts} is a {@link ConcurrentHashMap} - safe concurrent
 *       inserts keyed by part number, no external locking needed since
 *       each part number is written exactly once.</li>
 *   <li>{@link #completedCount} is an {@link AtomicInteger} so workers can
 *       cheaply detect "was I the one who finished the last part?" without
 *       taking a lock on every part completion.</li>
 *   <li>{@link #completionStarted} is an {@link AtomicBoolean} guarded by
 *       compareAndSet so exactly one worker ever fires the
 *       CompleteMultipartUpload call, even if the last two parts finish in
 *       the same instant on different threads.</li>
 *   <li>{@link #state} transitions go through a single {@code synchronized}
 *       method because state changes are rare (a handful per session) and
 *       must be strictly ordered - unlike part completions, which are
 *       frequent and independent of each other.</li>
 * </ul>
 */
public final class UploadSession {

    private final String id;
    private final String objectKey;
    private final String r2UploadId;
    private final int totalParts;
    private final Instant createdAt = Instant.now();

    private final Map<Integer, PartResult> parts = new ConcurrentHashMap<>();
    private final AtomicInteger completedCount = new AtomicInteger(0);
    private final AtomicBoolean completionStarted = new AtomicBoolean(false);

    private volatile UploadState state = new InitiatedState();

    public UploadSession(String id, String objectKey, String r2UploadId, int totalParts) {
        this.id = id;
        this.objectKey = objectKey;
        this.r2UploadId = r2UploadId;
        this.totalParts = totalParts;
    }

    public String id() {
        return id;
    }

    public String objectKey() {
        return objectKey;
    }

    public String r2UploadId() {
        return r2UploadId;
    }

    public int totalParts() {
        return totalParts;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public UploadStatus status() {
        return state.status();
    }

    public Collection<PartResult> parts() {
        return parts.values();
    }

    public int completedPartCount() {
        return completedCount.get();
    }

    /**
     * Records a completed part and advances the state machine. Returns true
     * exactly once, to the single caller that observes the final part and
     * wins the compare-and-set race to trigger completion - callers should
     * only kick off CompleteMultipartUpload when this returns true.
     */
    public synchronized boolean recordPartAndCheckReadyToComplete(PartResult result) {
        PartResult previous = parts.put(result.partNumber(), result);
        if (previous != null) {
            // A retry may replace an R2 eTag, but it must not count as a new part.
            return false;
        }
        state = state.onPartCompleted(this, completedCount.incrementAndGet());
        return claimCompletionIfReady();
    }

    /**
     * Atomically claims the right to run CompleteMultipartUpload, if (and
     * only if) all parts are in and nobody has claimed it yet. Both the
     * pipeline's auto-trigger and an explicit {@code POST /complete} call
     * race to call this - {@link #completionStarted}'s compareAndSet
     * guarantees exactly one of them wins.
     */
    public synchronized boolean claimCompletionIfReady() {
        if (completedCount.get() == totalParts && completionStarted.compareAndSet(false, true)) {
            state = state.onAllPartsAccounted(this);
            return true;
        }
        return false;
    }

    public synchronized void markCompleted() {
        state = state.onComplete(this);
    }

    public synchronized void markAborted() {
        state = state.onAbort(this);
    }

    public synchronized void markFailed(Throwable cause) {
        state = state.onError(this, cause);
    }
}
