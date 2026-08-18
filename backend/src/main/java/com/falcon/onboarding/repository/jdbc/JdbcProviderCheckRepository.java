package com.falcon.onboarding.repository.jdbc;

import com.falcon.onboarding.repository.ProviderCheckRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

@Repository
public class JdbcProviderCheckRepository implements ProviderCheckRepository {

    private final JdbcTemplate jdbc;

    public JdbcProviderCheckRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void record(String applicationId, String checkType, String providerMode, String status,
            String resultCode, String correlationId) {
        jdbc.update("""
                INSERT INTO provider_check
                    (id, application_id, check_type, provider_mode, status, result_code, correlation_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID().toString(), applicationId, checkType, providerMode, status, resultCode,
                correlationId, Timestamp.from(Instant.now()));
    }
}
