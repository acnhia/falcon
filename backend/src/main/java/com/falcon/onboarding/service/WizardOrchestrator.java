package com.falcon.onboarding.service;

import java.util.List;
import java.util.Map;

/**
 * Orchestrates the resumable wizard/workflow activities (see
 * docs/brokerage-onboarding/05-wizard-data-and-services.md) on top of the
 * existing {@link OnboardingOrchestrator}. Kept as a separate service so the
 * identity-capture orchestrator's contract and tests are untouched by this
 * newer, still-partial workflow model.
 */
public interface WizardOrchestrator {

    ResumeState getResumeState(String publicReference);

    ResumeState saveDraft(String publicReference, int activityNumber, Map<String, String> fields, String idempotencyKey);

    ResumeState continueActivity(String publicReference, int activityNumber, String idempotencyKey);

    record ResumeState(
            String publicReference,
            int currentActivityNumber,
            int wizardScreen,
            int completionPercentage,
            List<ActivityView> activities,
            Map<String, String> fieldValues) {
    }

    record ActivityView(int activityNumber, String status, String blockedReasonCode) {
    }
}
