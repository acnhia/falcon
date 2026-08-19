package com.falcon.onboarding.domain;

import java.time.Instant;

/**
 * A single user-entered field value. Stored as plain text in this POC - only
 * ever synthetic data is collected (see REQUIREMENTS.md); real production use
 * would require encryption/key management for this column.
 */
public record FieldValue(String fieldKey, String value, Instant updatedAt) {
}
