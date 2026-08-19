package com.falcon.onboarding.repository;

import com.falcon.onboarding.domain.ActivityStatus;
import com.falcon.onboarding.domain.OnboardingActivity;

import java.util.List;
import java.util.Optional;

public interface ActivityRepository {

    /** Total workflow activities defined in 05-wizard-data-and-services.md, not all wired to real logic yet. */
    int TOTAL_ACTIVITIES = 21;

    /** Creates all 21 activity rows as NOT_STARTED. Safe to call once per new application. */
    void initializeAll(String applicationId);

    void updateStatus(String applicationId, int activityNumber, ActivityStatus status, String blockedReasonCode);

    List<OnboardingActivity> findAll(String applicationId);

    Optional<OnboardingActivity> find(String applicationId, int activityNumber);
}
