package com.falcon.onboarding.task;

public record TaskResult<O>(
        String status,
        String taskName,
        String correlationId,
        O output,
        long durationMs) {

    public static <O> TaskResult<O> success(String taskName, String correlationId, O output, long durationMs) {
        return new TaskResult<>("SUCCESS", taskName, correlationId, output, durationMs);
    }
}
