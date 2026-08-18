package com.falcon.onboarding.task;

import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.service.OnboardingOrchestrator;

public class GetApplicationStatusTask extends BaseTask<OnboardingApplication> {

    private final OnboardingOrchestrator orchestrator;
    private final String publicReference;

    public GetApplicationStatusTask(OnboardingOrchestrator orchestrator, String publicReference) {
        this.orchestrator = orchestrator;
        this.publicReference = publicReference;
    }

    @Override
    protected String taskName() {
        return "GetApplicationStatus";
    }

    @Override
    protected OnboardingApplication execute() {
        return orchestrator.getApplicationByPublicReference(publicReference);
    }
}
