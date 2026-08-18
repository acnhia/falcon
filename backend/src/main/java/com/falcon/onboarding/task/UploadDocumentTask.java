package com.falcon.onboarding.task;

import com.falcon.onboarding.domain.DocumentSide;
import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.service.OnboardingOrchestrator;

public class UploadDocumentTask extends BaseTask<OnboardingApplication> {

    public record Input(String rawToken, DocumentSide side, byte[] content, String contentType) {
    }

    private final OnboardingOrchestrator orchestrator;
    private final Input input;

    public UploadDocumentTask(OnboardingOrchestrator orchestrator, Input input) {
        this.orchestrator = orchestrator;
        this.input = input;
    }

    @Override
    protected String taskName() {
        return "UploadDocument";
    }

    @Override
    protected OnboardingApplication execute() {
        return orchestrator.uploadDocument(input.rawToken(), input.side(), input.content(), input.contentType());
    }
}
