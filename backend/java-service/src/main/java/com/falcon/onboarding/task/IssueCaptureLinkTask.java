package com.falcon.onboarding.task;

import com.falcon.onboarding.service.OnboardingOrchestrator;

public class IssueCaptureLinkTask extends BaseTask<OnboardingOrchestrator.CaptureLink> {

    private final OnboardingOrchestrator orchestrator;
    private final String publicReference;

    public IssueCaptureLinkTask(OnboardingOrchestrator orchestrator, String publicReference) {
        this.orchestrator = orchestrator;
        this.publicReference = publicReference;
    }

    @Override
    protected String taskName() {
        return "IssueCaptureLink";
    }

    @Override
    protected OnboardingOrchestrator.CaptureLink execute() {
        return orchestrator.issueCaptureLink(publicReference);
    }
}
