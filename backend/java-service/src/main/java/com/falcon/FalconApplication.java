package com.falcon;

import com.falcon.onboarding.config.OnboardingProperties;
import com.falcon.upload.config.R2Properties;
import com.falcon.upload.config.UploadProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * Entry point for both bounded contexts in this service: {@code com.falcon.onboarding} (the
 * brokerage-onboarding reference implementation) and {@code com.falcon.upload} (the unrelated
 * file-transfer demo). Living at the namespace root means component scanning covers both without
 * a {@code scanBasePackages} override, which the previous location inside the upload package
 * required.
 */
@SpringBootApplication
@EnableConfigurationProperties({R2Properties.class, UploadProperties.class, OnboardingProperties.class})
public class FalconApplication {

    public static void main(String[] args) {
        SpringApplication.run(FalconApplication.class, args);
    }
}
