package com.falcon.onboarding.repository.jdbc;

import com.falcon.onboarding.domain.ActivityStatus;
import com.falcon.onboarding.domain.OnboardingActivity;
import com.falcon.onboarding.repository.ActivityRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class JdbcActivityRepository implements ActivityRepository {

    private final JdbcTemplate jdbc;

    public JdbcActivityRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void initializeAll(String applicationId) {
        List<Integer> existing = jdbc.queryForList(
                "SELECT activity_number FROM onboarding_activity WHERE application_id = ?", Integer.class, applicationId);
        for (int activityNumber = 1; activityNumber <= TOTAL_ACTIVITIES; activityNumber++) {
            if (!existing.contains(activityNumber)) {
                jdbc.update("""
                        INSERT INTO onboarding_activity (application_id, activity_number, status, blocked_reason_code, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        applicationId, activityNumber, ActivityStatus.NOT_STARTED.name(), null, Timestamp.from(Instant.now()));
            }
        }
    }

    @Override
    public void updateStatus(String applicationId, int activityNumber, ActivityStatus status, String blockedReasonCode) {
        int updated = jdbc.update("""
                UPDATE onboarding_activity
                SET status = ?, blocked_reason_code = ?, updated_at = ?
                WHERE application_id = ? AND activity_number = ?
                """,
                status.name(), blockedReasonCode, Timestamp.from(Instant.now()), applicationId, activityNumber);
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO onboarding_activity (application_id, activity_number, status, blocked_reason_code, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    applicationId, activityNumber, status.name(), blockedReasonCode, Timestamp.from(Instant.now()));
        }
    }

    @Override
    public List<OnboardingActivity> findAll(String applicationId) {
        return jdbc.query(
                "SELECT * FROM onboarding_activity WHERE application_id = ? ORDER BY activity_number",
                this::mapRow, applicationId);
    }

    @Override
    public Optional<OnboardingActivity> find(String applicationId, int activityNumber) {
        return jdbc.query(
                "SELECT * FROM onboarding_activity WHERE application_id = ? AND activity_number = ?",
                this::mapRow, applicationId, activityNumber).stream().findFirst();
    }

    private OnboardingActivity mapRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new OnboardingActivity(
                rs.getInt("activity_number"),
                ActivityStatus.valueOf(rs.getString("status")),
                rs.getString("blocked_reason_code"));
    }
}
