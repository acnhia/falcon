package com.falcon.onboarding.task;

import com.falcon.onboarding.service.WizardOrchestrator;

public class ContinueActivityTask extends BaseTask<WizardOrchestrator.ResumeState> {

    public record Input(String publicReference, int activityNumber, String idempotencyKey) {
    }

    private final WizardOrchestrator orchestrator;
    private final Input input;

    public ContinueActivityTask(WizardOrchestrator orchestrator, Input input) {
        this.orchestrator = orchestrator;
        this.input = input;
    }

    @Override
    protected String taskName() {
        return "ContinueActivity";
    }

    @Override
    protected WizardOrchestrator.ResumeState execute() {
        return orchestrator.continueActivity(input.publicReference(), input.activityNumber(), input.idempotencyKey());
    }
}
