package com.falcon.upload.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "r2")
public record R2Properties(String accountId, String accessKey, String secretKey, String endpoint, String bucket) {
}
