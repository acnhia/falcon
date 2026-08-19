package com.falcon.onboarding.web.dto;

import java.util.List;
import java.util.Map;

public record ResumeStateResponse(
        String publicReference,
        int currentActivityNumber,
        int wizardScreen,
        int completionPercentage,
        List<ActivityStatusResponse> activities,
        Map<String, String> fieldValues) {
}
