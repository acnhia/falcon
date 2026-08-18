package com.falcon.onboarding.repository.jdbc;

import com.falcon.onboarding.domain.ActivityStatus;
import com.falcon.onboarding.domain.DocumentRecord;
import com.falcon.onboarding.domain.DocumentSide;
import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.domain.OnboardingStatus;
import com.falcon.onboarding.repository.ActivityRepository;
import com.falcon.onboarding.repository.OnboardingApplicationRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;

@Repository
public class JdbcOnboardingApplicationRepository implements OnboardingApplicationRepository {

    private final JdbcTemplate jdbc;
    private final ActivityRepository activityRepository;

    public JdbcOnboardingApplicationRepository(JdbcTemplate jdbc, ActivityRepository activityRepository) {
        this.jdbc = jdbc;
        this.activityRepository = activityRepository;
    }

    @Override
    public void save(OnboardingApplication application) {
        int updated = jdbc.update("""
                UPDATE onboarding_application
                SET overall_status = ?, validation_triggered = ?, updated_at = ?
                WHERE id = ?
                """,
                application.status().name(),
                application.isValidationTriggered(),
                Timestamp.from(Instant.now()),
                application.id());
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO onboarding_application
                        (id, public_reference, overall_status, validation_triggered, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    application.id(), application.publicReference(), application.status().name(), false,
                    Timestamp.from(application.createdAt()), Timestamp.from(Instant.now()));
            // Every workflow activity gets a resumable row from the start (see
            // docs/brokerage-onboarding/05-wizard-data-and-services.md) - only
            // activities 1-4 have real logic wired up so far, but a truthful
            // resume-pointer/completion-percentage needs all 21 rows to exist.
            activityRepository.initializeAll(application.id());
            // Activity 2 ("create or resume application") is a system activity
            // completed by the act of creating this row; activity 1 (consent) is
            // a user activity, completed only when the wizard explicitly submits it.
            activityRepository.updateStatus(application.id(), 2, ActivityStatus.COMPLETED, null);
        }

        for (DocumentRecord document : application.documents()) {
            saveDocument(application.id(), document);
        }
    }

    private void saveDocument(String applicationId, DocumentRecord document) {
        int updated = jdbc.update("""
                UPDATE identity_document
                SET object_key = ?, mime_type = ?, byte_size = ?, checksum = ?, captured_at = ?
                WHERE application_id = ? AND side = ?
                """,
                document.objectKey(), document.mimeType(), document.byteSize(), document.checksum(),
                Timestamp.from(document.capturedAt()), applicationId, document.side().name());
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO identity_document
                        (application_id, side, object_key, mime_type, byte_size, checksum, captured_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    applicationId, document.side().name(), document.objectKey(), document.mimeType(),
                    document.byteSize(), document.checksum(), Timestamp.from(document.capturedAt()));
        }
    }

    @Override
    public Optional<OnboardingApplication> findById(String id) {
        return jdbc.query("SELECT * FROM onboarding_application WHERE id = ?", this::mapRow, id)
                .stream().findFirst();
    }

    @Override
    public Optional<OnboardingApplication> findByPublicReference(String publicReference) {
        return jdbc.query("SELECT * FROM onboarding_application WHERE public_reference = ?", this::mapRow, publicReference)
                .stream().findFirst();
    }

    private OnboardingApplication mapRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        String id = rs.getString("id");
        Map<DocumentSide, DocumentRecord> documents = new EnumMap<>(DocumentSide.class);
        jdbc.query("SELECT * FROM identity_document WHERE application_id = ?",
                (docRs, docRowNum) -> {
                    DocumentSide side = DocumentSide.valueOf(docRs.getString("side"));
                    documents.put(side, new DocumentRecord(
                            side, docRs.getString("object_key"), docRs.getString("mime_type"),
                            docRs.getLong("byte_size"), docRs.getString("checksum"),
                            docRs.getTimestamp("captured_at").toInstant()));
                    return null;
                }, id);

        return OnboardingApplication.rehydrate(
                id,
                rs.getString("public_reference"),
                rs.getTimestamp("created_at").toInstant(),
                documents,
                rs.getBoolean("validation_triggered"),
                OnboardingStatus.valueOf(rs.getString("overall_status")));
    }
}
