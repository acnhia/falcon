package com.falcon.onboarding.repository;

import com.falcon.onboarding.domain.FieldValue;

import java.util.Map;

public interface FieldValueRepository {

    void save(String applicationId, FieldValue value);

    Map<String, FieldValue> findAllForApplication(String applicationId);
}
