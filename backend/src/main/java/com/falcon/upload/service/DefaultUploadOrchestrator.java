package com.falcon.upload.service;

import com.falcon.upload.config.UploadProperties;
import com.falcon.upload.domain.PartResult;
import com.falcon.upload.domain.UploadSession;
import com.falcon.upload.domain.UploadStatus;
import com.falcon.upload.exception.SessionNotFoundException;
import com.falcon.upload.exception.StorageException;
import com.falcon.upload.repository.UploadSessionRepository;
import com.falcon.upload.storage.ObjectStorageClient;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.stereotype.Service;

@Service
public class DefaultUploadOrchestrator implements UploadOrchestrator {

    private final UploadSessionRepository repository;
    private final ObjectStorageClient storageClient;
    private final PartUploadPipeline pipeline;
    private final UploadProperties properties;

    public DefaultUploadOrchestrator(
            UploadSessionRepository repository, ObjectStorageClient storageClient, PartUploadPipeline pipeline, UploadProperties properties) {
        this.repository = repository;
        this.storageClient = storageClient;
        this.pipeline = pipeline;
        this.properties = properties;
    }

    @Override
    public UploadSession initiate(String filename, int totalParts) {
        String objectKey = "%s-%s".formatted(UUID.randomUUID(), filename);
        String r2UploadId = storageClient.createMultipartUpload(objectKey);
        UploadSession session = new UploadSession(UUID.randomUUID().toString(), objectKey, r2UploadId, totalParts);
        repository.save(session);
        return session;
    }

    @Override
    public PartResult submitPart(String sessionId, int partNumber, byte[] data) {
        UploadSession session = requireSession(sessionId);
        var future = pipeline.submit(sessionId, session.objectKey(), session.r2UploadId(), partNumber, data);
        try {
            return future.get(properties.partCompleteTimeoutSeconds(), TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new StorageException("Interrupted while uploading part " + partNumber, e);
        } catch (ExecutionException e) {
            throw new StorageException("Failed to upload part " + partNumber, e.getCause());
        } catch (TimeoutException e) {
            throw new StorageException("Timed out uploading part " + partNumber, e);
        }
    }

    @Override
    public UploadSession status(String sessionId) {
        return requireSession(sessionId);
    }

    @Override
    public void complete(String sessionId) {
        UploadSession session = requireSession(sessionId);
        if (session.status() == UploadStatus.COMPLETED) {
            return;
        }
        if (session.claimCompletionIfReady()) {
            storageClient.completeMultipartUpload(session.objectKey(), session.r2UploadId(), List.copyOf(session.parts()));
            session.markCompleted();
        }
        // else: not all parts have arrived yet, or the pipeline already claimed
        // completion and is finishing it asynchronously - caller should poll status.
    }

    @Override
    public void abort(String sessionId) {
        UploadSession session = requireSession(sessionId);
        storageClient.abortMultipartUpload(session.objectKey(), session.r2UploadId());
        session.markAborted();
    }

    private UploadSession requireSession(String sessionId) {
        return repository.findById(sessionId).orElseThrow(() -> new SessionNotFoundException(sessionId));
    }
}
