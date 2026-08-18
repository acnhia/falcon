package com.falcon.onboarding.repository;

public interface AuditEventRepository {

    /** Records an append-only, redacted audit entry. Never pass PII or document content as metadata. */
    void record(String applicationId, String eventType, Integer activityNumber, String correlationId, String metadata);
}
