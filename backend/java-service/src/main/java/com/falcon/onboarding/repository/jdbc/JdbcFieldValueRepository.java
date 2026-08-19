package com.falcon.onboarding.repository.jdbc;

import com.falcon.onboarding.domain.FieldValue;
import com.falcon.onboarding.repository.FieldValueRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.Map;

@Repository
public class JdbcFieldValueRepository implements FieldValueRepository {

    private final JdbcTemplate jdbc;

    public JdbcFieldValueRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void save(String applicationId, FieldValue value) {
        int updated = jdbc.update("""
                UPDATE application_field_value
                SET "value" = ?, updated_at = ?
                WHERE application_id = ? AND field_key = ?
                """,
                value.value(), Timestamp.from(value.updatedAt()), applicationId, value.fieldKey());
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO application_field_value (application_id, field_key, "value", updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    applicationId, value.fieldKey(), value.value(), Timestamp.from(value.updatedAt()));
        }
    }

    @Override
    public Map<String, FieldValue> findAllForApplication(String applicationId) {
        Map<String, FieldValue> values = new LinkedHashMap<>();
        jdbc.query("SELECT * FROM application_field_value WHERE application_id = ?", (rs, rowNum) -> {
            String key = rs.getString("field_key");
            values.put(key, new FieldValue(key, rs.getString("value"), rs.getTimestamp("updated_at").toInstant()));
            return null;
        }, applicationId);
        return values;
    }
}
