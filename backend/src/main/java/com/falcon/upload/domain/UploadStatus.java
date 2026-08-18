package com.falcon.upload.domain;

/** Externally-visible status label for each {@link UploadState} implementation. */
public enum UploadStatus {
    INITIATED,
    UPLOADING,
    COMPLETING,
    COMPLETED,
    FAILED,
    ABORTED
}
