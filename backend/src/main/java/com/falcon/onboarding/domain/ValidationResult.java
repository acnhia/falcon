package com.falcon.onboarding.domain;

import java.time.Instant;

public record ValidationResult(ValidationStatus status, Instant checkedAt) {
}
