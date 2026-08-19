package com.falcon.onboarding.workflow;

import com.falcon.onboarding.domain.OnboardingActivity;
import com.falcon.onboarding.repository.ActivityRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Computes the resume pointer and completion percentage from persisted
 * activity rows - the browser is never the source of truth for progress
 * (see docs/brokerage-onboarding/05-wizard-data-and-services.md).
 */
@Service
public class ActivityProgressService {

    private final ActivityRepository activityRepository;

    public ActivityProgressService(ActivityRepository activityRepository) {
        this.activityRepository = activityRepository;
    }

    /** The earliest activity that is neither COMPLETED nor NOT_APPLICABLE. */
    public int currentActivityNumber(String applicationId) {
        List<OnboardingActivity> activities = activityRepository.findAll(applicationId);
        return activities.stream()
                .filter(activity -> !activity.isDone())
                .mapToInt(OnboardingActivity::activityNumber)
                .min()
                .orElse(ActivityRepository.TOTAL_ACTIVITIES);
    }

    public int completionPercentage(String applicationId) {
        List<OnboardingActivity> activities = activityRepository.findAll(applicationId);
        if (activities.isEmpty()) {
            return 0;
        }
        long done = activities.stream().filter(OnboardingActivity::isDone).count();
        return (int) Math.round((done * 100.0) / activities.size());
    }

    /** Maps an activity number to its wizard screen, per the 8-screen table in 05-wizard-data-and-services.md. */
    public int wizardScreenFor(int activityNumber) {
        if (activityNumber <= 2) return 1;
        if (activityNumber <= 4) return 2;
        if (activityNumber <= 7) return 3;
        if (activityNumber <= 10) return 4;
        if (activityNumber <= 13) return 5;
        if (activityNumber <= 16) return 6;
        if (activityNumber <= 19) return 7;
        return 8;
    }
}
