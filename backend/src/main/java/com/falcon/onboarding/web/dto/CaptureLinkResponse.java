package com.falcon.onboarding.web.dto;

import java.time.Instant;

/**
 * {@code captureUrl} is built server-side from the configured, trusted
 * {@code onboarding.capture-base-url} - never from a browser-supplied Host
 * header - and contains only the opaque raw token, never the internal
 * application ID.
 */
public record CaptureLinkResponse(String captureUrl, Instant expiresAt) {
}
