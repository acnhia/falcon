package com.falcon.onboarding.domain;

/** One resumable state row for one of the 21 workflow activities. */
public record OnboardingActivity(int activityNumber, ActivityStatus status, String blockedReasonCode) {

    public static OnboardingActivity notStarted(int activityNumber) {
        return new OnboardingActivity(activityNumber, ActivityStatus.NOT_STARTED, null);
    }

    public boolean isDone() {
        return status == ActivityStatus.COMPLETED || status == ActivityStatus.NOT_APPLICABLE;
    }
}
