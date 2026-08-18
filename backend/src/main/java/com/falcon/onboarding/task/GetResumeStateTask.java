package com.falcon.onboarding.task;

import com.falcon.onboarding.service.WizardOrchestrator;

public class GetResumeStateTask extends BaseTask<WizardOrchestrator.ResumeState> {

    private final WizardOrchestrator orchestrator;
    private final String publicReference;

    public GetResumeStateTask(WizardOrchestrator orchestrator, String publicReference) {
        this.orchestrator = orchestrator;
        this.publicReference = publicReference;
    }

    @Override
    protected String taskName() {
        return "GetResumeState";
    }

    @Override
    protected WizardOrchestrator.ResumeState execute() {
        return orchestrator.getResumeState(publicReference);
    }
}
