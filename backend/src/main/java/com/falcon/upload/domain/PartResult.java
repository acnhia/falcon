package com.falcon.upload.domain;

import java.time.Instant;

public record PartResult(int partNumber, String eTag, long sizeBytes, Instant completedAt) {
}
