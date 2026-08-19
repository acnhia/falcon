package com.falcon.onboarding.repository;

import com.falcon.onboarding.domain.OnboardingApplication;

import java.util.Optional;

public interface OnboardingApplicationRepository {
    void save(OnboardingApplication application);

    Optional<OnboardingApplication> findById(String id);

    Optional<OnboardingApplication> findByPublicReference(String publicReference);
}
