package com.falcon.onboarding.task;

import com.falcon.onboarding.service.OnboardingOrchestrator;

public class GetCaptureContextTask extends BaseTask<OnboardingOrchestrator.CaptureContext> {

    private final OnboardingOrchestrator orchestrator;
    private final String rawToken;

    public GetCaptureContextTask(OnboardingOrchestrator orchestrator, String rawToken) {
        this.orchestrator = orchestrator;
        this.rawToken = rawToken;
    }

    @Override
    protected String taskName() {
        return "GetCaptureContext";
    }

    @Override
    protected OnboardingOrchestrator.CaptureContext execute() {
        return orchestrator.getCaptureContext(rawToken);
    }
}
