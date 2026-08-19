package com.falcon.onboarding.web.dto;

public record DocumentUploadResponse(String side, boolean accepted, boolean bothSidesCaptured, String status) {
}
