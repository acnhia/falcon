package com.falcon.onboarding;

import com.falcon.onboarding.config.OnboardingProperties;
import com.falcon.upload.UploadDemoApplication;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = UploadDemoApplication.class)
class OnboardingComponentScanTest {

    @org.springframework.beans.factory.annotation.Autowired
    private OnboardingProperties onboardingProperties;

    @Test
    void contextLoadsWithOnboardingPropertiesRegistered() {
        assertThat(onboardingProperties).isNotNull();
        assertThat(onboardingProperties.storagePrefix()).isEqualTo("onboarding");
    }
}
