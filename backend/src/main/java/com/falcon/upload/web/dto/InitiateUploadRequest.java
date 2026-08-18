package com.falcon.upload.web.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record InitiateUploadRequest(@NotBlank String filename, @Min(1) int totalParts) {
}
