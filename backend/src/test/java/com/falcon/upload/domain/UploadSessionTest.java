package com.falcon.upload.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class UploadSessionTest {

    @Test
    void duplicatePartDoesNotAdvanceCompletionCountOrCompleteSessionEarly() {
        UploadSession session = new UploadSession("session-1", "uploads/file", "r2-upload-1", 2);

        assertThat(session.recordPartAndCheckReadyToComplete(part(1, "first"))).isFalse();
        assertThat(session.recordPartAndCheckReadyToComplete(part(1, "replacement"))).isFalse();

        assertThat(session.completedPartCount()).isEqualTo(1);
        assertThat(session.parts()).hasSize(1);
        assertThat(session.status()).isEqualTo(UploadStatus.UPLOADING);
    }

    @Test
    void finalDistinctPartClaimsCompletionExactlyOnce() {
        UploadSession session = new UploadSession("session-1", "uploads/file", "r2-upload-1", 2);

        assertThat(session.recordPartAndCheckReadyToComplete(part(1, "one"))).isFalse();
        assertThat(session.recordPartAndCheckReadyToComplete(part(2, "two"))).isTrue();
        assertThat(session.claimCompletionIfReady()).isFalse();
        assertThat(session.status()).isEqualTo(UploadStatus.COMPLETING);
    }

    private static PartResult part(int number, String eTag) {
        return new PartResult(number, eTag, 5 * 1024 * 1024L, Instant.now());
    }
}
