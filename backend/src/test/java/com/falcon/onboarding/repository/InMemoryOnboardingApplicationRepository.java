package com.falcon.onboarding.repository;

import com.falcon.onboarding.domain.OnboardingApplication;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Test-only in-memory double for {@link OnboardingApplicationRepository}. The
 * production bean is {@code JdbcOnboardingApplicationRepository}; this class
 * exists so orchestrator-level tests can exercise orchestration logic without
 * a real datasource.
 */
public class InMemoryOnboardingApplicationRepository implements OnboardingApplicationRepository {

    private final Map<String, OnboardingApplication> byId = new ConcurrentHashMap<>();
    private final Map<String, String> publicReferenceToId = new ConcurrentHashMap<>();

    @Override
    public void save(OnboardingApplication application) {
        byId.put(application.id(), application);
        publicReferenceToId.put(application.publicReference(), application.id());
    }

    @Override
    public Optional<OnboardingApplication> findById(String id) {
        return Optional.ofNullable(byId.get(id));
    }

    @Override
    public Optional<OnboardingApplication> findByPublicReference(String publicReference) {
        String id = publicReferenceToId.get(publicReference);
        return id == null ? Optional.empty() : findById(id);
    }
}
