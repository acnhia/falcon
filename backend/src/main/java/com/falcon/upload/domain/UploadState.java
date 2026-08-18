package com.falcon.upload.domain;

/**
 * State pattern: each lifecycle stage of an {@link UploadSession} is its own
 * class instead of an enum + switch. A state decides which transitions are
 * legal from itself and returns the next state; illegal transitions throw
 * rather than silently corrupting the session.
 */
public interface UploadState {

    UploadStatus status();

    default UploadState onPartCompleted(UploadSession session, int totalPartsSeenSoFar) {
        throw illegal("part completion");
    }

    default UploadState onAllPartsAccounted(UploadSession session) {
        throw illegal("moving to completing");
    }

    default UploadState onComplete(UploadSession session) {
        throw illegal("completion");
    }

    default UploadState onAbort(UploadSession session) {
        return new AbortedState();
    }

    default UploadState onError(UploadSession session, Throwable cause) {
        return new FailedState(cause);
    }

    private IllegalStateTransitionException illegal(String action) {
        return new IllegalStateTransitionException(
                "Cannot perform '%s' while session is in state %s".formatted(action, status()));
    }
}
