package com.falcon.onboarding.repository.jdbc;

import com.falcon.onboarding.domain.CaptureToken;
import com.falcon.onboarding.repository.CaptureTokenRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.Optional;

@Repository
public class JdbcCaptureTokenRepository implements CaptureTokenRepository {

    private final JdbcTemplate jdbc;

    public JdbcCaptureTokenRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void save(CaptureToken token) {
        int updated = jdbc.update("""
                UPDATE identity_capture_session
                SET consumed = ?
                WHERE token_hash = ?
                """,
                token.isConsumed(), token.tokenHash());
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO identity_capture_session (token_hash, application_id, expires_at, consumed)
                    VALUES (?, ?, ?, ?)
                    """,
                    token.tokenHash(), token.applicationId(), Timestamp.from(token.expiresAt()), token.isConsumed());
        }
    }

    @Override
    public Optional<CaptureToken> findByHash(String tokenHash) {
        return jdbc.query("SELECT * FROM identity_capture_session WHERE token_hash = ?",
                (rs, rowNum) -> CaptureToken.rehydrate(
                        rs.getString("token_hash"),
                        rs.getString("application_id"),
                        rs.getTimestamp("expires_at").toInstant(),
                        rs.getBoolean("consumed")),
                tokenHash).stream().findFirst();
    }
}
