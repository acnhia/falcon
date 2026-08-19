package com.falcon.onboarding.service;

import com.falcon.onboarding.domain.CaptureToken;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class CaptureTokenIssuerTest {

    private final CaptureTokenIssuer issuer = new CaptureTokenIssuer();

    @Test
    void issuedTokenIsUrlSafeAndHasAtLeast32BytesOfEntropy() {
        CaptureTokenIssuer.IssuedToken issued = issuer.issue("app-1", Duration.ofMinutes(15));

        assertThat(issued.rawToken()).matches("[A-Za-z0-9_-]+");
        // Base64 URL without padding: ceil(32 bytes * 8 / 6) = 43 chars.
        assertThat(issued.rawToken().length()).isGreaterThanOrEqualTo(43);
    }

    @Test
    void issuedTokenIsNeverEqualToItsStoredHash() {
        CaptureTokenIssuer.IssuedToken issued = issuer.issue("app-1", Duration.ofMinutes(15));

        assertThat(issued.storedToken().tokenHash()).isNotEqualTo(issued.rawToken());
        assertThat(issued.storedToken().tokenHash()).isEqualTo(CaptureTokenIssuer.hash(issued.rawToken()));
    }

    @Test
    void sameApplicationIssuedTwiceProducesDifferentTokens() {
        CaptureTokenIssuer.IssuedToken first = issuer.issue("app-1", Duration.ofMinutes(15));
        CaptureTokenIssuer.IssuedToken second = issuer.issue("app-1", Duration.ofMinutes(15));

        assertThat(first.rawToken()).isNotEqualTo(second.rawToken());
        assertThat(first.storedToken().tokenHash()).isNotEqualTo(second.storedToken().tokenHash());
    }

    @Test
    void storedTokenCarriesApplicationIdAndFutureExpiry() {
        Instant before = Instant.now();
        CaptureTokenIssuer.IssuedToken issued = issuer.issue("app-42", Duration.ofMinutes(15));

        CaptureToken stored = issued.storedToken();
        assertThat(stored.applicationId()).isEqualTo("app-42");
        assertThat(stored.expiresAt()).isAfter(before.plus(Duration.ofMinutes(14)));
        assertThat(stored.isExpired(before)).isFalse();
    }
}
