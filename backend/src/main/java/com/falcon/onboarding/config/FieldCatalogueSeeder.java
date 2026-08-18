package com.falcon.onboarding.config;

import com.falcon.onboarding.domain.FieldDataType;
import com.falcon.onboarding.domain.FieldDefinition;
import com.falcon.onboarding.repository.FieldDefinitionRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

/**
 * Seeds the activity-3 (personal information) field catalogue - the only
 * field-definition-driven activity built so far. Idempotent: {@link
 * FieldDefinitionRepository#seed} skips a field key that already exists.
 */
@Component
public class FieldCatalogueSeeder {

    private static final int PERSONAL_INFORMATION_ACTIVITY = 3;
    private static final int SCHEMA_VERSION = 1;

    private final FieldDefinitionRepository repository;

    public FieldCatalogueSeeder(FieldDefinitionRepository repository) {
        this.repository = repository;
    }

    @PostConstruct
    void seed() {
        seed("legalFirstName", FieldDataType.STRING, true);
        seed("legalLastName", FieldDataType.STRING, true);
        seed("dateOfBirth", FieldDataType.DATE, true);
        seed("email", FieldDataType.EMAIL, true);
        seed("residentialCountry", FieldDataType.COUNTRY, true);
        seed("preferredFirstName", FieldDataType.STRING, false);
        seed("preferredLastName", FieldDataType.STRING, false);
        seed("phone", FieldDataType.PHONE, false);
    }

    private void seed(String fieldKey, FieldDataType dataType, boolean required) {
        repository.seed(new FieldDefinition(fieldKey, PERSONAL_INFORMATION_ACTIVITY, dataType, required, SCHEMA_VERSION));
    }
}
