package com.falcon.onboarding.domain;

public final class DraftState implements OnboardingState {

    @Override
    public OnboardingStatus status() {
        return OnboardingStatus.DRAFT;
    }

    @Override
    public OnboardingState onCaptureLinkIssued(OnboardingApplication application) {
        return new IdentityCaptureRequestedState();
    }
}
