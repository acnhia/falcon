package com.falcon.onboarding.domain;

/** A single versioned entry in the field catalogue - see {@code field_definition} in 05-wizard-data-and-services.md. */
public record FieldDefinition(
        String fieldKey,
        int activityNumber,
        FieldDataType dataType,
        boolean required,
        int schemaVersion) {
}
