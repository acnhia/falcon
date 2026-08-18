package com.falcon.upload.repository;

import com.falcon.upload.domain.UploadSession;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Repository;

/**
 * Single-instance, in-memory session store. Fine for this demo (one backend
 * container); a multi-replica deployment would need a shared store (Redis)
 * behind the same {@link UploadSessionRepository} interface instead.
 */
@Repository
public class InMemoryUploadSessionRepository implements UploadSessionRepository {

    private final Map<String, UploadSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void save(UploadSession session) {
        sessions.put(session.id(), session);
    }

    @Override
    public Optional<UploadSession> findById(String sessionId) {
        return Optional.ofNullable(sessions.get(sessionId));
    }

    @Override
    public void delete(String sessionId) {
        sessions.remove(sessionId);
    }
}
