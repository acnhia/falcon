package com.falcon.onboarding.domain;

public final class IdentityValidatedState implements OnboardingState {

    @Override
    public OnboardingStatus status() {
        return OnboardingStatus.IDENTITY_VALIDATED;
    }

    @Override
    public OnboardingState onReadyForReview(OnboardingApplication application) {
        return new ReadyForReviewState();
    }
}
