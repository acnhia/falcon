package com.falcon.upload.web;

import com.falcon.upload.domain.PartResult;
import com.falcon.upload.domain.UploadSession;
import com.falcon.upload.service.UploadOrchestrator;
import com.falcon.upload.web.dto.InitiateUploadRequest;
import com.falcon.upload.web.dto.InitiateUploadResponse;
import com.falcon.upload.web.dto.PartUploadResponse;
import com.falcon.upload.web.dto.UploadStatusResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    private final UploadOrchestrator orchestrator;

    public UploadController(UploadOrchestrator orchestrator) {
        this.orchestrator = orchestrator;
    }

    @PostMapping
    public InitiateUploadResponse initiate(@Valid @RequestBody InitiateUploadRequest request) {
        UploadSession session = orchestrator.initiate(request.filename(), request.totalParts());
        return new InitiateUploadResponse(session.id(), session.objectKey(), session.totalParts());
    }

    @PutMapping("/{sessionId}/parts/{partNumber}")
    public PartUploadResponse uploadPart(
            @PathVariable String sessionId, @PathVariable int partNumber, @RequestBody byte[] body) {
        PartResult result = orchestrator.submitPart(sessionId, partNumber, body);
        return new PartUploadResponse(result.partNumber(), result.eTag());
    }

    @PostMapping("/{sessionId}/complete")
    public ResponseEntity<Void> complete(@PathVariable String sessionId) {
        orchestrator.complete(sessionId);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/{sessionId}/abort")
    public ResponseEntity<Void> abort(@PathVariable String sessionId) {
        orchestrator.abort(sessionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{sessionId}")
    public UploadStatusResponse status(@PathVariable String sessionId) {
        UploadSession session = orchestrator.status(sessionId);
        return new UploadStatusResponse(session.id(), session.status(), session.completedPartCount(), session.totalParts());
    }
}
