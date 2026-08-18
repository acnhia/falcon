package com.falcon.onboarding.domain;

/** Status of one of the 21 workflow activities - see docs/brokerage-onboarding/05-wizard-data-and-services.md. */
public enum ActivityStatus {
    NOT_STARTED,
    IN_PROGRESS,
    COMPLETED,
    BLOCKED,
    RETRYABLE,
    STALE,
    NOT_APPLICABLE
}
