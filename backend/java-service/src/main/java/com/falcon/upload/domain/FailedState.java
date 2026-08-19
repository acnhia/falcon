package com.falcon.upload.domain;

/** Terminal error state: a part upload or the completion call failed unrecoverably. */
public final class FailedState implements UploadState {

    private final Throwable cause;

    public FailedState(Throwable cause) {
        this.cause = cause;
    }

    public Throwable cause() {
        return cause;
    }

    @Override
    public UploadStatus status() {
        return UploadStatus.FAILED;
    }
}
