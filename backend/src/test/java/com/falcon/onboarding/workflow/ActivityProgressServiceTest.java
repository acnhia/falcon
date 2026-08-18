package com.falcon.onboarding.workflow;

import com.falcon.onboarding.domain.ActivityStatus;
import com.falcon.onboarding.repository.ActivityRepository;
import com.falcon.upload.UploadDemoApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = UploadDemoApplication.class)
class ActivityProgressServiceTest {

    @Autowired
    private ActivityRepository activityRepository;
    @Autowired
    private ActivityProgressService progressService;

    @Test
    void freshApplicationResumesAtActivityOne() {
        String applicationId = UUID.randomUUID().toString();
        activityRepository.initializeAll(applicationId);

        assertThat(progressService.currentActivityNumber(applicationId)).isEqualTo(1);
        assertThat(progressService.completionPercentage(applicationId)).isEqualTo(0);
    }

    @Test
    void resumesAtEarliestIncompleteActivityForAPartiallyCompletedApplication() {
        String applicationId = UUID.randomUUID().toString();
        activityRepository.initializeAll(applicationId);
        activityRepository.updateStatus(applicationId, 1, ActivityStatus.COMPLETED, null);
        activityRepository.updateStatus(applicationId, 2, ActivityStatus.COMPLETED, null);

        assertThat(progressService.currentActivityNumber(applicationId)).isEqualTo(3);
        assertThat(progressService.wizardScreenFor(3)).isEqualTo(2);
    }

    @Test
    void completionPercentageReflectsCompletedAndNotApplicableActivities() {
        String applicationId = UUID.randomUUID().toString();
        activityRepository.initializeAll(applicationId);
        for (int i = 1; i <= 21; i++) {
            activityRepository.updateStatus(applicationId, i,
                    i <= 4 ? ActivityStatus.COMPLETED : ActivityStatus.NOT_STARTED, null);
        }

        // 4 of 21 completed
        assertThat(progressService.completionPercentage(applicationId)).isEqualTo(19);
    }

    @Test
    void allActivitiesDoneResumesAtTotalActivityCount() {
        String applicationId = UUID.randomUUID().toString();
        activityRepository.initializeAll(applicationId);
        for (int i = 1; i <= ActivityRepository.TOTAL_ACTIVITIES; i++) {
            activityRepository.updateStatus(applicationId, i, ActivityStatus.COMPLETED, null);
        }

        assertThat(progressService.currentActivityNumber(applicationId)).isEqualTo(ActivityRepository.TOTAL_ACTIVITIES);
        assertThat(progressService.completionPercentage(applicationId)).isEqualTo(100);
    }
}
