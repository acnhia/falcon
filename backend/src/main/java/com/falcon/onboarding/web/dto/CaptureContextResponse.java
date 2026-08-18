package com.falcon.onboarding.web.dto;

public record CaptureContextResponse(boolean frontCaptured, boolean backCaptured, String status) {
}
