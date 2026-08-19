package com.falcon.onboarding.web;

import com.falcon.onboarding.domain.DocumentSide;
import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.service.OnboardingOrchestrator;
import com.falcon.onboarding.task.TaskRegistry;
import com.falcon.onboarding.task.UploadDocumentTask;
import com.falcon.onboarding.web.dto.CaptureContextResponse;
import com.falcon.onboarding.web.dto.DocumentUploadResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/onboarding/captures")
public class CaptureController {

    private final TaskRegistry taskRegistry;

    public CaptureController(TaskRegistry taskRegistry) {
        this.taskRegistry = taskRegistry;
    }

    @GetMapping("/{token}")
    public CaptureContextResponse context(@PathVariable String token) {
        OnboardingOrchestrator.CaptureContext context =
                taskRegistry.<OnboardingOrchestrator.CaptureContext>execute("GetCaptureContext", token).output();
        return new CaptureContextResponse(context.frontCaptured(), context.backCaptured(), context.status());
    }

    @PutMapping("/{token}/documents/front")
    public DocumentUploadResponse uploadFront(
            @PathVariable String token,
            @RequestHeader(HttpHeaders.CONTENT_TYPE) String contentType,
            @RequestBody byte[] body) {
        return upload(token, DocumentSide.FRONT, body, contentType);
    }

    @PutMapping("/{token}/documents/back")
    public DocumentUploadResponse uploadBack(
            @PathVariable String token,
            @RequestHeader(HttpHeaders.CONTENT_TYPE) String contentType,
            @RequestBody byte[] body) {
        return upload(token, DocumentSide.BACK, body, contentType);
    }

    private DocumentUploadResponse upload(String token, DocumentSide side, byte[] body, String contentType) {
        UploadDocumentTask.Input input = new UploadDocumentTask.Input(token, side, body, contentType);
        OnboardingApplication application =
                taskRegistry.<OnboardingApplication>execute("UploadDocument", input).output();
        return new DocumentUploadResponse(
                side.name(), true, application.hasBothSides(), application.status().name());
    }
}
