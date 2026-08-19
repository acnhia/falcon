package com.falcon.onboarding.web;

import com.falcon.onboarding.config.OnboardingProperties;
import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.service.OnboardingOrchestrator;
import com.falcon.onboarding.service.WizardOrchestrator;
import com.falcon.onboarding.task.ContinueActivityTask;
import com.falcon.onboarding.task.SaveActivityDraftTask;
import com.falcon.onboarding.task.TaskRegistry;
import com.falcon.onboarding.web.dto.ActivityDraftRequest;
import com.falcon.onboarding.web.dto.ActivityStatusResponse;
import com.falcon.onboarding.web.dto.ApplicationStatusResponse;
import com.falcon.onboarding.web.dto.CaptureLinkResponse;
import com.falcon.onboarding.web.dto.ContinueActivityRequest;
import com.falcon.onboarding.web.dto.CreateApplicationResponse;
import com.falcon.onboarding.web.dto.ResumeStateResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/onboarding")
public class OnboardingController {

    private final TaskRegistry taskRegistry;
    private final OnboardingProperties properties;

    public OnboardingController(TaskRegistry taskRegistry, OnboardingProperties properties) {
        this.taskRegistry = taskRegistry;
        this.properties = properties;
    }

    @PostMapping("/applications")
    public CreateApplicationResponse create() {
        OnboardingApplication application = taskRegistry.<OnboardingApplication>execute("CreateApplication", null).output();
        return new CreateApplicationResponse(application.publicReference(), application.status().name());
    }

    @GetMapping("/applications/{publicReference}")
    public ApplicationStatusResponse status(@PathVariable String publicReference) {
        OnboardingApplication application =
                taskRegistry.<OnboardingApplication>execute("GetApplicationStatus", publicReference).output();
        return new ApplicationStatusResponse(application.publicReference(), application.status().name());
    }

    @PostMapping("/applications/{publicReference}/capture-links")
    public CaptureLinkResponse issueCaptureLink(@PathVariable String publicReference) {
        OnboardingOrchestrator.CaptureLink link =
                taskRegistry.<OnboardingOrchestrator.CaptureLink>execute("IssueCaptureLink", publicReference).output();
        String captureUrl = properties.captureBaseUrl() + "/#/capture/" + link.rawToken();
        return new CaptureLinkResponse(captureUrl, link.expiresAt());
    }

    @GetMapping("/applications/{publicReference}/resume")
    public ResumeStateResponse resume(@PathVariable String publicReference) {
        return toResponse(taskRegistry.<WizardOrchestrator.ResumeState>execute("GetResumeState", publicReference).output());
    }

    @PutMapping("/applications/{publicReference}/activities/{activityNumber}")
    public ResumeStateResponse saveDraft(
            @PathVariable String publicReference, @PathVariable int activityNumber, @RequestBody ActivityDraftRequest request) {
        SaveActivityDraftTask.Input input =
                new SaveActivityDraftTask.Input(publicReference, activityNumber, request.fields(), request.idempotencyKey());
        return toResponse(taskRegistry.<WizardOrchestrator.ResumeState>execute("SaveActivityDraft", input).output());
    }

    @PostMapping("/applications/{publicReference}/activities/{activityNumber}/continue")
    public ResumeStateResponse continueActivity(
            @PathVariable String publicReference, @PathVariable int activityNumber, @RequestBody ContinueActivityRequest request) {
        ContinueActivityTask.Input input = new ContinueActivityTask.Input(publicReference, activityNumber, request.idempotencyKey());
        return toResponse(taskRegistry.<WizardOrchestrator.ResumeState>execute("ContinueActivity", input).output());
    }

    private static ResumeStateResponse toResponse(WizardOrchestrator.ResumeState state) {
        return new ResumeStateResponse(
                state.publicReference(),
                state.currentActivityNumber(),
                state.wizardScreen(),
                state.completionPercentage(),
                state.activities().stream()
                        .map(a -> new ActivityStatusResponse(a.activityNumber(), a.status(), a.blockedReasonCode()))
                        .toList(),
                state.fieldValues());
    }
}
