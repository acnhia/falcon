package com.falcon.onboarding.task;

import com.falcon.onboarding.exception.TaskValidationException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BaseTaskTest {

    @Test
    void runReturnsExecuteResult() {
        BaseTask<String> task = new BaseTask<>() {
            @Override
            protected String taskName() {
                return "EchoTask";
            }

            @Override
            protected String execute() {
                return "result";
            }
        };

        assertThat(task.run("correlation-1")).isEqualTo("result");
    }

    @Test
    void validateHookRunsBeforeExecuteAndCanRejectTheTask() {
        BaseTask<String> task = new BaseTask<>() {
            @Override
            protected String taskName() {
                return "RejectingTask";
            }

            @Override
            protected void validate() {
                throw new TaskValidationException("invalid input");
            }

            @Override
            protected String execute() {
                throw new AssertionError("execute() must not run when validate() rejects the task");
            }
        };

        assertThatThrownBy(() -> task.run("correlation-2"))
                .isInstanceOf(TaskValidationException.class);
    }

    @Test
    void runRethrowsTheOriginalExceptionTypeUnwrapped() {
        BaseTask<String> task = new BaseTask<>() {
            @Override
            protected String taskName() {
                return "FailingTask";
            }

            @Override
            protected String execute() {
                throw new IllegalStateException("boom");
            }
        };

        assertThatThrownBy(() -> task.run("correlation-3"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("boom");
    }
}
