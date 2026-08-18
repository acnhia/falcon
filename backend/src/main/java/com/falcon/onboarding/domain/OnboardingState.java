package com.falcon.onboarding.domain;

/**
 * State pattern, mirroring {@code upload.domain.UploadState}: each lifecycle
 * stage of an {@link OnboardingApplication} is its own class. A state
 * decides which transitions are legal from itself and returns the next
 * state; illegal transitions throw rather than silently corrupting the
 * application.
 */
public interface OnboardingState {

    OnboardingStatus status();

    default OnboardingState onCaptureLinkIssued(OnboardingApplication application) {
        throw illegal("issuing a capture link");
    }

    default OnboardingState onDocumentsCaptured(OnboardingApplication application) {
        throw illegal("recording captured documents");
    }

    default OnboardingState onValidated(OnboardingApplication application, ValidationResult result) {
        throw illegal("recording a validation result");
    }

    default OnboardingState onReadyForReview(OnboardingApplication application) {
        throw illegal("moving to review");
    }

    private IllegalStateTransitionException illegal(String action) {
        return new IllegalStateTransitionException(
                "Cannot perform '%s' while application is in state %s".formatted(action, status()));
    }

    /** Maps a persisted status back to its state instance - used only when rehydrating from storage. */
    static OnboardingState forStatus(OnboardingStatus status) {
        return switch (status) {
            case DRAFT -> new DraftState();
            case IDENTITY_CAPTURE_REQUESTED -> new IdentityCaptureRequestedState();
            case IDENTITY_CAPTURED -> new IdentityCapturedState();
            case IDENTITY_VALIDATED -> new IdentityValidatedState();
            case READY_FOR_REVIEW -> new ReadyForReviewState();
        };
    }
}
