package com.falcon.onboarding.repository;

import com.falcon.onboarding.domain.FieldDefinition;

import java.util.List;

public interface FieldDefinitionRepository {

    /** Seeds a definition if its key doesn't already exist. Idempotent. */
    void seed(FieldDefinition definition);

    List<FieldDefinition> findByActivityNumber(int activityNumber);
}
