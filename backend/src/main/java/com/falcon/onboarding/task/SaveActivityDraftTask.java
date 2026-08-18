package com.falcon.onboarding.task;

import com.falcon.onboarding.service.WizardOrchestrator;

import java.util.Map;

public class SaveActivityDraftTask extends BaseTask<WizardOrchestrator.ResumeState> {

    public record Input(String publicReference, int activityNumber, Map<String, String> fields, String idempotencyKey) {
    }

    private final WizardOrchestrator orchestrator;
    private final Input input;

    public SaveActivityDraftTask(WizardOrchestrator orchestrator, Input input) {
        this.orchestrator = orchestrator;
        this.input = input;
    }

    @Override
    protected String taskName() {
        return "SaveActivityDraft";
    }

    @Override
    protected WizardOrchestrator.ResumeState execute() {
        return orchestrator.saveDraft(input.publicReference(), input.activityNumber(), input.fields(), input.idempotencyKey());
    }
}
