package com.falcon.upload.domain;

/**
 * All expected parts have been accounted for and the CompleteMultipartUpload
 * call to R2 is in flight (fired via CompletableFuture off the worker thread
 * that observed the last part). Transient by design.
 */
public final class CompletingState implements UploadState {

    @Override
    public UploadStatus status() {
        return UploadStatus.COMPLETING;
    }

    @Override
    public UploadState onComplete(UploadSession session) {
        return new CompletedState();
    }
}
