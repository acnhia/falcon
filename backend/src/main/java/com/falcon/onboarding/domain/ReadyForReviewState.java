package com.falcon.onboarding.domain;

/** Terminal state for this POC slice; every transition is illegal from here. */
public final class ReadyForReviewState implements OnboardingState {

    @Override
    public OnboardingStatus status() {
        return OnboardingStatus.READY_FOR_REVIEW;
    }
}
