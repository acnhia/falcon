package com.falcon.upload;

import com.falcon.onboarding.config.OnboardingProperties;
import com.falcon.upload.config.R2Properties;
import com.falcon.upload.config.UploadProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication(scanBasePackages = "com.falcon")
@EnableConfigurationProperties({R2Properties.class, UploadProperties.class, OnboardingProperties.class})
public class UploadDemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(UploadDemoApplication.class, args);
    }
}
