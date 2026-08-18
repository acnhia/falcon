package com.falcon.onboarding.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CaptureTokenTest {

    @Test
    void tokenIsNotExpiredBeforeExpiryInstant() {
        Instant expiresAt = Instant.now().plusSeconds(60);
        CaptureToken token = new CaptureToken("hash", "app-1", expiresAt);

        assertThat(token.isExpired(Instant.now())).isFalse();
    }

    @Test
    void tokenIsExpiredAfterExpiryInstant() {
        Instant expiresAt = Instant.now().minusSeconds(1);
        CaptureToken token = new CaptureToken("hash", "app-1", expiresAt);

        assertThat(token.isExpired(Instant.now())).isTrue();
    }

    @Test
    void firstConsumeSucceedsSecondConsumeFails() {
        CaptureToken token = new CaptureToken("hash", "app-1", Instant.now().plusSeconds(60));

        assertThat(token.tryConsume()).isTrue();
        assertThat(token.tryConsume()).isFalse();
        assertThat(token.isConsumed()).isTrue();
    }

    @Test
    void concurrentConsumeAttemptsOnlyOneSucceeds() throws Exception {
        CaptureToken token = new CaptureToken("hash", "app-1", Instant.now().plusSeconds(60));
        int threadCount = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threadCount);
        CountDownLatch ready = new CountDownLatch(threadCount);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int i = 0; i < threadCount; i++) {
                results.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    return token.tryConsume();
                }));
            }
            ready.await();
            go.countDown();

            AtomicInteger winners = new AtomicInteger(0);
            for (Future<Boolean> result : results) {
                if (result.get(5, TimeUnit.SECONDS)) {
                    winners.incrementAndGet();
                }
            }
            assertThat(winners.get()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }
}
