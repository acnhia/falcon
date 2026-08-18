package com.falcon.onboarding.domain;

import java.time.Instant;

/**
 * Deliberately minimal: only what the POC needs to prove storage/validation
 * worked. Never add applicant name, license number, or other extracted
 * identity fields here - the mock validator never produces them.
 */
public record DocumentRecord(
        DocumentSide side,
        String objectKey,
        String mimeType,
        long byteSize,
        String checksum,
        Instant capturedAt) {
}
