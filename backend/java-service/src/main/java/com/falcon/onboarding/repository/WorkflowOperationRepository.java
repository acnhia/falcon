package com.falcon.onboarding.repository;

public interface WorkflowOperationRepository {

    boolean existsCompleted(String applicationId, String idempotencyKey);

    void recordCompleted(String applicationId, String idempotencyKey, String operationType);
}
