package com.falcon.onboarding.task;

import com.falcon.onboarding.exception.UnknownTaskException;

import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

/**
 * Allowlisted task dispatch: {@link #factories} is an explicit, fixed map
 * built by the constructor - a client can only ever trigger one of these
 * named tasks, never load or select an arbitrary class.
 */
public class TaskRegistry {

    private final Map<String, Function<Object, Task<?>>> factories;

    public TaskRegistry(Map<String, Function<Object, Task<?>>> factories) {
        this.factories = Map.copyOf(factories);
    }

    @SuppressWarnings("unchecked")
    public <O> TaskResult<O> execute(String taskName, Object input) {
        Function<Object, Task<?>> factory = factories.get(taskName);
        if (factory == null) {
            throw new UnknownTaskException(taskName);
        }
        String correlationId = UUID.randomUUID().toString();
        long startNanos = System.nanoTime();
        Task<O> task = (Task<O>) factory.apply(input);
        O output = task.run(correlationId);
        long durationMs = (System.nanoTime() - startNanos) / 1_000_000;
        return TaskResult.success(taskName, correlationId, output, durationMs);
    }
}
