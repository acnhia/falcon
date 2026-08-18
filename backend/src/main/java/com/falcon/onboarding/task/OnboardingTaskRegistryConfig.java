package com.falcon.onboarding.task;

import com.falcon.onboarding.service.OnboardingOrchestrator;
import com.falcon.onboarding.service.WizardOrchestrator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

/**
 * Builds the onboarding {@link TaskRegistry}'s allowlist explicitly - the
 * only tasks a controller can ever trigger by name are the ones listed
 * here, wired to this one {@link OnboardingOrchestrator}/{@link WizardOrchestrator} instance.
 */
@Configuration
public class OnboardingTaskRegistryConfig {

    @Bean
    public TaskRegistry onboardingTaskRegistry(OnboardingOrchestrator orchestrator, WizardOrchestrator wizardOrchestrator) {
        return new TaskRegistry(Map.of(
                "CreateApplication", input -> new CreateApplicationTask(orchestrator),
                "GetApplicationStatus", input -> new GetApplicationStatusTask(orchestrator, (String) input),
                "IssueCaptureLink", input -> new IssueCaptureLinkTask(orchestrator, (String) input),
                "GetCaptureContext", input -> new GetCaptureContextTask(orchestrator, (String) input),
                "UploadDocument", input -> new UploadDocumentTask(orchestrator, (UploadDocumentTask.Input) input),
                "GetResumeState", input -> new GetResumeStateTask(wizardOrchestrator, (String) input),
                "SaveActivityDraft", input -> new SaveActivityDraftTask(wizardOrchestrator, (SaveActivityDraftTask.Input) input),
                "ContinueActivity", input -> new ContinueActivityTask(wizardOrchestrator, (ContinueActivityTask.Input) input)));
    }
}
