package com.falcon.upload.service;

import com.falcon.upload.domain.PartResult;
import com.falcon.upload.domain.UploadSession;

/**
 * Facade over the repository, storage adapter, and upload pipeline. Callers
 * (the REST layer) only ever see this interface - they don't know or care
 * that a part upload involves a queue, worker threads, and a state machine
 * underneath.
 */
public interface UploadOrchestrator {

    UploadSession initiate(String filename, int totalParts);

    PartResult submitPart(String sessionId, int partNumber, byte[] data);

    UploadSession status(String sessionId);

    void complete(String sessionId);

    void abort(String sessionId);
}
