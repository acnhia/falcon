package com.falcon.onboarding.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "onboarding")
public record OnboardingProperties(
        int captureLinkExpiryMinutes,
        String storagePrefix,
        long maxDocumentBytes,
        int maxImageDimensionPx,
        String captureBaseUrl) {
}
