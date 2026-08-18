package com.falcon.onboarding.domain;

public final class IdentityCapturedState implements OnboardingState {

    @Override
    public OnboardingStatus status() {
        return OnboardingStatus.IDENTITY_CAPTURED;
    }

    @Override
    public OnboardingState onValidated(OnboardingApplication application, ValidationResult result) {
        return new IdentityValidatedState();
    }
}
