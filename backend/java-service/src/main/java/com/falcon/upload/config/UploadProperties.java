package com.falcon.upload.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "upload")
public record UploadProperties(int workerPoolSize, int partCompleteTimeoutSeconds) {
}
