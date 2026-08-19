package com.falcon.onboarding.domain;

/**
 * Only {@code VALIDATED} exists today because the POC's validator is a
 * deterministic mock. A future real provider adapter would add outcomes
 * such as {@code REJECTED}/{@code NEEDS_REVIEW}, and {@link
 * IdentityCapturedState#onValidated} would branch on them.
 */
public enum ValidationStatus {
    VALIDATED
}
