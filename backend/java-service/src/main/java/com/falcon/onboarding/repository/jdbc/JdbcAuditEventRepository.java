package com.falcon.onboarding.repository.jdbc;

import com.falcon.onboarding.repository.AuditEventRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

@Repository
public class JdbcAuditEventRepository implements AuditEventRepository {

    private final JdbcTemplate jdbc;

    public JdbcAuditEventRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void record(String applicationId, String eventType, Integer activityNumber, String correlationId, String metadata) {
        jdbc.update("""
                INSERT INTO application_audit_event
                    (id, application_id, event_type, activity_number, actor, correlation_id, created_at, metadata)
                VALUES (?, ?, ?, ?, 'SYSTEM', ?, ?, ?)
                """,
                UUID.randomUUID().toString(), applicationId, eventType, activityNumber, correlationId,
                Timestamp.from(Instant.now()), metadata);
    }
}
