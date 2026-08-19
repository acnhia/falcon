package com.falcon.onboarding.repository.jdbc;

import com.falcon.onboarding.domain.FieldDataType;
import com.falcon.onboarding.domain.FieldDefinition;
import com.falcon.onboarding.repository.FieldDefinitionRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class JdbcFieldDefinitionRepository implements FieldDefinitionRepository {

    private final JdbcTemplate jdbc;

    public JdbcFieldDefinitionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void seed(FieldDefinition definition) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM field_definition WHERE field_key = ?", Integer.class, definition.fieldKey());
        if (count != null && count > 0) {
            return;
        }
        jdbc.update("""
                INSERT INTO field_definition (field_key, activity_number, data_type, required, schema_version)
                VALUES (?, ?, ?, ?, ?)
                """,
                definition.fieldKey(), definition.activityNumber(), definition.dataType().name(),
                definition.required(), definition.schemaVersion());
    }

    @Override
    public List<FieldDefinition> findByActivityNumber(int activityNumber) {
        return jdbc.query(
                "SELECT * FROM field_definition WHERE activity_number = ? ORDER BY field_key",
                (rs, rowNum) -> new FieldDefinition(
                        rs.getString("field_key"),
                        rs.getInt("activity_number"),
                        FieldDataType.valueOf(rs.getString("data_type")),
                        rs.getBoolean("required"),
                        rs.getInt("schema_version")),
                activityNumber);
    }
}
