package com.falcon.onboarding.domain;

public final class IdentityCaptureRequestedState implements OnboardingState {

    @Override
    public OnboardingStatus status() {
        return OnboardingStatus.IDENTITY_CAPTURE_REQUESTED;
    }

    @Override
    public OnboardingState onDocumentsCaptured(OnboardingApplication application) {
        return new IdentityCapturedState();
    }
}
