package com.falcon.onboarding.task;

import com.falcon.onboarding.exception.UnknownTaskException;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TaskRegistryTest {

    @Test
    void unknownTaskNameThrowsUnknownTaskException() {
        TaskRegistry registry = new TaskRegistry(Map.of());

        assertThatThrownBy(() -> registry.execute("DoesNotExist", null))
                .isInstanceOf(UnknownTaskException.class);
    }

    @Test
    void knownTaskDispatchesAndReturnsEnvelopeWithCorrelationId() {
        TaskRegistry registry = new TaskRegistry(Map.of(
                "Echo", input -> echoTask((String) input)));

        TaskResult<String> result = registry.execute("Echo", "hello");

        assertThat(result.status()).isEqualTo("SUCCESS");
        assertThat(result.taskName()).isEqualTo("Echo");
        assertThat(result.output()).isEqualTo("hello");
        assertThat(result.correlationId()).isNotBlank();
    }

    @Test
    void failingTaskPropagatesOriginalExceptionTypeUnwrapped() {
        TaskRegistry registry = new TaskRegistry(Map.of(
                "Fail", input -> failingTask()));

        assertThatThrownBy(() -> registry.execute("Fail", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("boom");
    }

    private static Task<String> echoTask(String input) {
        return new BaseTask<>() {
            @Override
            protected String taskName() {
                return "Echo";
            }

            @Override
            protected String execute() {
                return input;
            }
        };
    }

    private static Task<Object> failingTask() {
        return new BaseTask<>() {
            @Override
            protected String taskName() {
                return "Fail";
            }

            @Override
            protected Object execute() {
                throw new IllegalStateException("boom");
            }
        };
    }
}
