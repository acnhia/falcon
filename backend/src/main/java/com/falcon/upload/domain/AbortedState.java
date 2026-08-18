package com.falcon.upload.domain;

/** Terminal state: the client (or an error handler) aborted the multipart upload. */
public final class AbortedState implements UploadState {

    @Override
    public UploadStatus status() {
        return UploadStatus.ABORTED;
    }
}
