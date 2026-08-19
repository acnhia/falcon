package com.falcon.onboarding.task;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Java port of the Otterobot {@code BaseTask} pattern (see
 * {@code ottera-repos/.../otterobot-task/v1/src/tasks/BaseTask.ts}): shared
 * timing/logging/error-handling boilerplate wraps one concrete
 * {@link #execute()}. Ported additions beyond the original (which has none
 * of these): a {@link #validate()} hook, a correlation ID threaded through
 * every log line, and redaction discipline - log lines never include
 * document bytes, capture tokens, or PII, only IDs/status/timing.
 *
 * <p>Failures are logged here but rethrown unchanged (not wrapped), so
 * callers further up (controllers, via {@code @RestControllerAdvice}) keep
 * mapping on the concrete exception type.
 */
public abstract class BaseTask<O> implements Task<O> {

    private static final Logger log = LoggerFactory.getLogger(BaseTask.class);

    protected abstract String taskName();

    protected abstract O execute();

    /** No-op by default; override to throw {@code TaskValidationException}. */
    protected void validate() {
    }

    @Override
    public final O run(String correlationId) {
        long startNanos = System.nanoTime();
        log.info("task={} correlationId={} status=STARTED", taskName(), correlationId);
        try {
            validate();
            O result = execute();
            log.info("task={} correlationId={} status=SUCCESS durationMs={}",
                    taskName(), correlationId, elapsedMs(startNanos));
            return result;
        } catch (RuntimeException ex) {
            log.warn("task={} correlationId={} status=FAILED durationMs={} errorType={}",
                    taskName(), correlationId, elapsedMs(startNanos), ex.getClass().getSimpleName());
            throw ex;
        }
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }
}
