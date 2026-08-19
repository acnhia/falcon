package com.falcon.upload.web.dto;

public record InitiateUploadResponse(String sessionId, String objectKey, int totalParts) {
}
