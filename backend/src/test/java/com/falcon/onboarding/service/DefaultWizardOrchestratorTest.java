package com.falcon.onboarding.service;

import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.exception.TaskValidationException;
import com.falcon.upload.UploadDemoApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = UploadDemoApplication.class)
class DefaultWizardOrchestratorTest {

    @Autowired
    private OnboardingOrchestrator onboardingOrchestrator;
    @Autowired
    private WizardOrchestrator wizardOrchestrator;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void continuingConsentActivityCompletesActivityOneAndAdvancesToPersonalInformation() {
        OnboardingApplication application = onboardingOrchestrator.createApplication();

        WizardOrchestrator.ResumeState state =
                wizardOrchestrator.continueActivity(application.publicReference(), 1, UUID.randomUUID().toString());

        assertThat(state.currentActivityNumber()).isEqualTo(3);
        assertThat(state.wizardScreen()).isEqualTo(2);
    }

    @Test
    void savingDraftThenContinuingActivityThreeCompletesItAndRunsMockPrecheck() {
        OnboardingApplication application = onboardingOrchestrator.createApplication();
        wizardOrchestrator.continueActivity(application.publicReference(), 1, UUID.randomUUID().toString());

        wizardOrchestrator.saveDraft(application.publicReference(), 3, adultFields(), UUID.randomUUID().toString());
        WizardOrchestrator.ResumeState state =
                wizardOrchestrator.continueActivity(application.publicReference(), 3, UUID.randomUUID().toString());

        assertThat(activityStatus(state, 3)).isEqualTo("COMPLETED");
        assertThat(activityStatus(state, 4)).isEqualTo("COMPLETED");
        assertThat(state.fieldValues()).containsEntry("legalFirstName", "Ada");
    }

    @Test
    void continuingActivityThreeWithMissingRequiredFieldsThrowsTaskValidationException() {
        OnboardingApplication application = onboardingOrchestrator.createApplication();
        wizardOrchestrator.continueActivity(application.publicReference(), 1, UUID.randomUUID().toString());

        Map<String, String> incomplete = new LinkedHashMap<>(adultFields());
        incomplete.remove("email");
        wizardOrchestrator.saveDraft(application.publicReference(), 3, incomplete, UUID.randomUUID().toString());

        assertThatThrownBy(() ->
                wizardOrchestrator.continueActivity(application.publicReference(), 3, UUID.randomUUID().toString()))
                .isInstanceOf(TaskValidationException.class)
                .hasMessageContaining("email");
    }

    @Test
    void underageDateOfBirthLeavesPrecheckActivityBlockedForReview() {
        OnboardingApplication application = onboardingOrchestrator.createApplication();
        wizardOrchestrator.continueActivity(application.publicReference(), 1, UUID.randomUUID().toString());

        Map<String, String> minor = new LinkedHashMap<>(adultFields());
        minor.put("dateOfBirth", java.time.LocalDate.now().minusYears(10).toString());
        wizardOrchestrator.saveDraft(application.publicReference(), 3, minor, UUID.randomUUID().toString());
        WizardOrchestrator.ResumeState state =
                wizardOrchestrator.continueActivity(application.publicReference(), 3, UUID.randomUUID().toString());

        assertThat(activityStatus(state, 3)).isEqualTo("COMPLETED");
        assertThat(activityStatus(state, 4)).isEqualTo("BLOCKED");
    }

    @Test
    void retryingContinueActivityWithSameIdempotencyKeyDoesNotRerunTheMockPrecheck() {
        OnboardingApplication application = onboardingOrchestrator.createApplication();
        wizardOrchestrator.continueActivity(application.publicReference(), 1, UUID.randomUUID().toString());
        wizardOrchestrator.saveDraft(application.publicReference(), 3, adultFields(), UUID.randomUUID().toString());

        String idempotencyKey = UUID.randomUUID().toString();
        wizardOrchestrator.continueActivity(application.publicReference(), 3, idempotencyKey);
        wizardOrchestrator.continueActivity(application.publicReference(), 3, idempotencyKey);

        Integer checkCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM provider_check WHERE application_id = ?", Integer.class, application.id());
        assertThat(checkCount).isEqualTo(1);
    }

    @Test
    void changingDateOfBirthAfterPrecheckCompletedMarksActivityFourStale() {
        OnboardingApplication application = onboardingOrchestrator.createApplication();
        wizardOrchestrator.continueActivity(application.publicReference(), 1, UUID.randomUUID().toString());
        wizardOrchestrator.saveDraft(application.publicReference(), 3, adultFields(), UUID.randomUUID().toString());
        wizardOrchestrator.continueActivity(application.publicReference(), 3, UUID.randomUUID().toString());

        Map<String, String> changedDob = new LinkedHashMap<>();
        changedDob.put("dateOfBirth", "1985-05-05");
        WizardOrchestrator.ResumeState state =
                wizardOrchestrator.saveDraft(application.publicReference(), 3, changedDob, UUID.randomUUID().toString());

        assertThat(activityStatus(state, 4)).isEqualTo("STALE");
    }

    @Test
    void unsupportedActivityNumberThrowsTaskValidationException() {
        OnboardingApplication application = onboardingOrchestrator.createApplication();

        assertThatThrownBy(() ->
                wizardOrchestrator.saveDraft(application.publicReference(), 5, Map.of(), UUID.randomUUID().toString()))
                .isInstanceOf(TaskValidationException.class);
    }

    private static Map<String, String> adultFields() {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("legalFirstName", "Ada");
        fields.put("legalLastName", "Lovelace");
        fields.put("dateOfBirth", "1990-01-01");
        fields.put("email", "ada@example.test");
        fields.put("residentialCountry", "US");
        return fields;
    }

    private static String activityStatus(WizardOrchestrator.ResumeState state, int activityNumber) {
        return state.activities().stream()
                .filter(a -> a.activityNumber() == activityNumber)
                .findFirst().orElseThrow()
                .status();
    }
}
