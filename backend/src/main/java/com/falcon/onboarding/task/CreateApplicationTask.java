package com.falcon.onboarding.task;

import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.service.OnboardingOrchestrator;

public class CreateApplicationTask extends BaseTask<OnboardingApplication> {

    private final OnboardingOrchestrator orchestrator;

    public CreateApplicationTask(OnboardingOrchestrator orchestrator) {
        this.orchestrator = orchestrator;
    }

    @Override
    protected String taskName() {
        return "CreateApplication";
    }

    @Override
    protected OnboardingApplication execute() {
        return orchestrator.createApplication();
    }
}
