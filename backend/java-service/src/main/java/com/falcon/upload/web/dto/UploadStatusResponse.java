package com.falcon.upload.web.dto;

import com.falcon.upload.domain.UploadStatus;

public record UploadStatusResponse(String sessionId, UploadStatus status, int completedParts, int totalParts) {
}
