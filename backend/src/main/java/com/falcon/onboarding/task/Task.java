package com.falcon.onboarding.task;

public interface Task<O> {
    O run(String correlationId);
}
