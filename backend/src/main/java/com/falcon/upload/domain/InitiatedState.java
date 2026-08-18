package com.falcon.upload.domain;

/** Session created and an R2 multipart upload started; no parts uploaded yet. */
public final class InitiatedState implements UploadState {

    @Override
    public UploadStatus status() {
        return UploadStatus.INITIATED;
    }

    @Override
    public UploadState onPartCompleted(UploadSession session, int totalPartsSeenSoFar) {
        return new UploadingState();
    }
}
