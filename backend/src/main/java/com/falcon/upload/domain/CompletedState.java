package com.falcon.upload.domain;

/** Terminal success state: R2 has assembled the object from its parts. */
public final class CompletedState implements UploadState {

    @Override
    public UploadStatus status() {
        return UploadStatus.COMPLETED;
    }

    @Override
    public UploadState onAbort(UploadSession session) {
        throw new IllegalStateTransitionException("Cannot abort an already-completed upload");
    }
}
