package com.falcon.onboarding.repository.jdbc;

import com.falcon.onboarding.domain.CaptureToken;
import com.falcon.onboarding.repository.CaptureTokenRepository;
import com.falcon.FalconApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = FalconApplication.class)
class JdbcCaptureTokenRepositoryTest {

    @Autowired
    private CaptureTokenRepository repository;

    @Test
    void savedTokenIsFindableByItsHashWithMatchingFields() {
        String hash = UUID.randomUUID().toString();
        String applicationId = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plusSeconds(60);
        CaptureToken token = new CaptureToken(hash, applicationId, expiresAt);

        repository.save(token);

        CaptureToken found = repository.findByHash(hash).orElseThrow();
        assertThat(found.applicationId()).isEqualTo(applicationId);
        assertThat(found.isConsumed()).isFalse();
    }

    @Test
    void unknownHashReturnsEmpty() {
        Optional<CaptureToken> result = repository.findByHash("no-such-hash-" + UUID.randomUUID());

        assertThat(result).isEmpty();
    }

    @Test
    void consumedStatePersistsAcrossSaves() {
        String hash = UUID.randomUUID().toString();
        CaptureToken token = new CaptureToken(hash, UUID.randomUUID().toString(), Instant.now().plusSeconds(60));
        repository.save(token);

        token.tryConsume();
        repository.save(token);

        assertThat(repository.findByHash(hash).orElseThrow().isConsumed()).isTrue();
    }
}
