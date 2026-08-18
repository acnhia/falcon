package com.falcon.upload.repository;

import com.falcon.upload.domain.UploadSession;
import java.util.Optional;

/**
 * Repository pattern: isolates session persistence from the orchestration
 * logic. Swapping the in-memory implementation for a Redis-backed one
 * (needed if the backend is ever scaled to multiple replicas) only requires
 * a new implementation of this interface - nothing else changes.
 */
public interface UploadSessionRepository {

    void save(UploadSession session);

    Optional<UploadSession> findById(String sessionId);

    void delete(String sessionId);
}
