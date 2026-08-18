package com.falcon.onboarding.web.dto;

import java.util.Map;

public record ActivityDraftRequest(Map<String, String> fields, String idempotencyKey) {
}
