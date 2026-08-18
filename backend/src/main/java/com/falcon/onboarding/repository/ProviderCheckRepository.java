package com.falcon.onboarding.repository;

public interface ProviderCheckRepository {

    void record(String applicationId, String checkType, String providerMode, String status,
            String resultCode, String correlationId);
}
