package com.falcon.upload.domain;

/** At least one part has been uploaded; more may still arrive concurrently. */
public final class UploadingState implements UploadState {

    @Override
    public UploadStatus status() {
        return UploadStatus.UPLOADING;
    }

    @Override
    public UploadState onPartCompleted(UploadSession session, int totalPartsSeenSoFar) {
        return this;
    }

    @Override
    public UploadState onAllPartsAccounted(UploadSession session) {
        return new CompletingState();
    }
}
