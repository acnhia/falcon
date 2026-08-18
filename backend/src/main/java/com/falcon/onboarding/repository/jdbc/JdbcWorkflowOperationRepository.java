package com.falcon.onboarding.repository.jdbc;

import com.falcon.onboarding.repository.WorkflowOperationRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;

@Repository
public class JdbcWorkflowOperationRepository implements WorkflowOperationRepository {

    private final JdbcTemplate jdbc;

    public JdbcWorkflowOperationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean existsCompleted(String applicationId, String idempotencyKey) {
        Integer count = jdbc.queryForObject("""
                SELECT COUNT(*) FROM workflow_operation
                WHERE application_id = ? AND idempotency_key = ? AND status = 'COMPLETED'
                """,
                Integer.class, applicationId, idempotencyKey);
        return count != null && count > 0;
    }

    @Override
    public void recordCompleted(String applicationId, String idempotencyKey, String operationType) {
        int updated = jdbc.update("""
                UPDATE workflow_operation
                SET status = 'COMPLETED', operation_type = ?
                WHERE application_id = ? AND idempotency_key = ?
                """,
                operationType, applicationId, idempotencyKey);
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO workflow_operation (application_id, idempotency_key, operation_type, status, error_code, created_at)
                    VALUES (?, ?, ?, 'COMPLETED', NULL, ?)
                    """,
                    applicationId, idempotencyKey, operationType, Timestamp.from(Instant.now()));
        }
    }
}
