package com.falcon.onboarding.service;

import com.falcon.onboarding.domain.DocumentSide;
import com.falcon.onboarding.domain.OnboardingApplication;

import java.time.Instant;

public interface OnboardingOrchestrator {

    OnboardingApplication createApplication();

    OnboardingApplication getApplicationByPublicReference(String publicReference);

    CaptureLink issueCaptureLink(String publicReference);

    CaptureContext getCaptureContext(String rawToken);

    OnboardingApplication uploadDocument(String rawToken, DocumentSide side, byte[] content, String contentType);

    record CaptureLink(String rawToken, Instant expiresAt) {
    }

    record CaptureContext(boolean frontCaptured, boolean backCaptured, String status) {
    }
}
