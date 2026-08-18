package com.falcon.onboarding.service;

import com.falcon.onboarding.domain.ActivityStatus;
import com.falcon.onboarding.domain.FieldDefinition;
import com.falcon.onboarding.domain.FieldValue;
import com.falcon.onboarding.domain.OnboardingActivity;
import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.exception.TaskValidationException;
import com.falcon.onboarding.repository.ActivityRepository;
import com.falcon.onboarding.repository.FieldDefinitionRepository;
import com.falcon.onboarding.repository.FieldValueRepository;
import com.falcon.onboarding.repository.AuditEventRepository;
import com.falcon.onboarding.repository.ProviderCheckRepository;
import com.falcon.onboarding.repository.WorkflowOperationRepository;
import com.falcon.onboarding.workflow.ActivityProgressService;
import com.falcon.onboarding.workflow.AgeIdentityPrecheckService;
import com.falcon.onboarding.workflow.PrecheckStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class DefaultWizardOrchestrator implements WizardOrchestrator {

    private static final int CONSENT_ACTIVITY = 1;
    /** Only activities 1 (consent) and 3 (personal information) have real save/continue logic in this phase. */
    private static final int PERSONAL_INFORMATION_ACTIVITY = 3;
    private static final int AGE_IDENTITY_PRECHECK_ACTIVITY = 4;
    private static final String DATE_OF_BIRTH_FIELD = "dateOfBirth";

    private final OnboardingOrchestrator onboardingOrchestrator;
    private final ActivityRepository activityRepository;
    private final FieldDefinitionRepository fieldDefinitionRepository;
    private final FieldValueRepository fieldValueRepository;
    private final WorkflowOperationRepository workflowOperationRepository;
    private final AuditEventRepository auditEventRepository;
    private final ProviderCheckRepository providerCheckRepository;
    private final ActivityProgressService progressService;
    private final AgeIdentityPrecheckService precheckService;

    public DefaultWizardOrchestrator(
            OnboardingOrchestrator onboardingOrchestrator,
            ActivityRepository activityRepository,
            FieldDefinitionRepository fieldDefinitionRepository,
            FieldValueRepository fieldValueRepository,
            WorkflowOperationRepository workflowOperationRepository,
            AuditEventRepository auditEventRepository,
            ProviderCheckRepository providerCheckRepository,
            ActivityProgressService progressService,
            AgeIdentityPrecheckService precheckService) {
        this.onboardingOrchestrator = onboardingOrchestrator;
        this.activityRepository = activityRepository;
        this.fieldDefinitionRepository = fieldDefinitionRepository;
        this.fieldValueRepository = fieldValueRepository;
        this.workflowOperationRepository = workflowOperationRepository;
        this.auditEventRepository = auditEventRepository;
        this.providerCheckRepository = providerCheckRepository;
        this.progressService = progressService;
        this.precheckService = precheckService;
    }

    @Override
    public ResumeState getResumeState(String publicReference) {
        return buildResumeState(onboardingOrchestrator.getApplicationByPublicReference(publicReference));
    }

    @Override
    public ResumeState saveDraft(String publicReference, int activityNumber, Map<String, String> fields, String idempotencyKey) {
        OnboardingApplication application = onboardingOrchestrator.getApplicationByPublicReference(publicReference);
        if (workflowOperationRepository.existsCompleted(application.id(), idempotencyKey)) {
            return buildResumeState(application);
        }
        requireSupportedActivity(activityNumber);

        Map<String, FieldValue> before = fieldValueRepository.findAllForApplication(application.id());
        String previousDateOfBirth = valueOf(before, DATE_OF_BIRTH_FIELD);

        Instant now = Instant.now();
        for (Map.Entry<String, String> entry : fields.entrySet()) {
            fieldValueRepository.save(application.id(), new FieldValue(entry.getKey(), entry.getValue(), now));
        }

        markStaleIfDateOfBirthChanged(application.id(), previousDateOfBirth, fields.get(DATE_OF_BIRTH_FIELD));

        OnboardingActivity activity3 = activityRepository.find(application.id(), PERSONAL_INFORMATION_ACTIVITY)
                .orElse(OnboardingActivity.notStarted(PERSONAL_INFORMATION_ACTIVITY));
        if (activity3.status() != ActivityStatus.COMPLETED) {
            activityRepository.updateStatus(application.id(), PERSONAL_INFORMATION_ACTIVITY, ActivityStatus.IN_PROGRESS, null);
        }

        workflowOperationRepository.recordCompleted(application.id(), idempotencyKey, "SaveActivityDraft");
        auditEventRepository.record(application.id(), "ACTIVITY_DRAFT_SAVED", activityNumber, idempotencyKey, null);
        return buildResumeState(application);
    }

    @Override
    public ResumeState continueActivity(String publicReference, int activityNumber, String idempotencyKey) {
        OnboardingApplication application = onboardingOrchestrator.getApplicationByPublicReference(publicReference);
        if (workflowOperationRepository.existsCompleted(application.id(), idempotencyKey)) {
            return buildResumeState(application);
        }

        if (activityNumber == CONSENT_ACTIVITY) {
            activityRepository.updateStatus(application.id(), CONSENT_ACTIVITY, ActivityStatus.COMPLETED, null);
            workflowOperationRepository.recordCompleted(application.id(), idempotencyKey, "ContinueActivity");
            auditEventRepository.record(application.id(), "ACTIVITY_CONTINUED", activityNumber, idempotencyKey, null);
            return buildResumeState(application);
        }
        requireSupportedActivity(activityNumber);

        Map<String, FieldValue> values = fieldValueRepository.findAllForApplication(application.id());
        List<FieldDefinition> definitions = fieldDefinitionRepository.findByActivityNumber(PERSONAL_INFORMATION_ACTIVITY);
        List<String> missing = definitions.stream()
                .filter(FieldDefinition::required)
                .map(FieldDefinition::fieldKey)
                .filter(key -> isBlank(valueOf(values, key)))
                .toList();
        if (!missing.isEmpty()) {
            throw new TaskValidationException("Missing required fields: " + String.join(", ", missing));
        }

        activityRepository.updateStatus(application.id(), PERSONAL_INFORMATION_ACTIVITY, ActivityStatus.COMPLETED, null);
        runAgeIdentityPrecheck(application.id(), valueOf(values, DATE_OF_BIRTH_FIELD), idempotencyKey);

        workflowOperationRepository.recordCompleted(application.id(), idempotencyKey, "ContinueActivity");
        auditEventRepository.record(application.id(), "ACTIVITY_CONTINUED", activityNumber, idempotencyKey, null);
        return buildResumeState(application);
    }

    private void runAgeIdentityPrecheck(String applicationId, String dateOfBirthValue, String correlationId) {
        LocalDate dateOfBirth = parseDateOrNull(dateOfBirthValue);
        PrecheckStatus result = precheckService.evaluate(dateOfBirth, LocalDate.now());

        providerCheckRepository.record(applicationId, "AGE_IDENTITY_PRECHECK", "MOCK", result.name(), result.name(), correlationId);

        ActivityStatus activityStatus = switch (result) {
            case PASS -> ActivityStatus.COMPLETED;
            case NEEDS_INPUT -> ActivityStatus.BLOCKED;
            case REVIEW -> ActivityStatus.BLOCKED;
        };
        String reasonCode = result == PrecheckStatus.PASS ? null : result.name();
        activityRepository.updateStatus(applicationId, AGE_IDENTITY_PRECHECK_ACTIVITY, activityStatus, reasonCode);
    }

    private void markStaleIfDateOfBirthChanged(String applicationId, String previousDateOfBirth, String newDateOfBirth) {
        if (newDateOfBirth == null || newDateOfBirth.equals(previousDateOfBirth)) {
            return;
        }
        Optional<OnboardingActivity> precheckActivity = activityRepository.find(applicationId, AGE_IDENTITY_PRECHECK_ACTIVITY);
        if (precheckActivity.isPresent() && precheckActivity.get().status() == ActivityStatus.COMPLETED) {
            activityRepository.updateStatus(applicationId, AGE_IDENTITY_PRECHECK_ACTIVITY, ActivityStatus.STALE, "SOURCE_FIELD_CHANGED");
        }
    }

    private ResumeState buildResumeState(OnboardingApplication application) {
        List<OnboardingActivity> activities = activityRepository.findAll(application.id());
        int currentActivityNumber = progressService.currentActivityNumber(application.id());
        Map<String, FieldValue> values = fieldValueRepository.findAllForApplication(application.id());

        return new ResumeState(
                application.publicReference(),
                currentActivityNumber,
                progressService.wizardScreenFor(currentActivityNumber),
                progressService.completionPercentage(application.id()),
                activities.stream()
                        .map(a -> new ActivityView(a.activityNumber(), a.status().name(), a.blockedReasonCode()))
                        .toList(),
                values.entrySet().stream().collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey, entry -> entry.getValue().value())));
    }

    private static void requireSupportedActivity(int activityNumber) {
        if (activityNumber != PERSONAL_INFORMATION_ACTIVITY) {
            throw new TaskValidationException("Activity " + activityNumber + " does not yet support save/continue");
        }
    }

    private static String valueOf(Map<String, FieldValue> values, String key) {
        FieldValue value = values.get(key);
        return value == null ? null : value.value();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static LocalDate parseDateOrNull(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }
}
