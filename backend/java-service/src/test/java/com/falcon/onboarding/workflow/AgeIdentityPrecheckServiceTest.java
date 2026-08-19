package com.falcon.onboarding.workflow;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class AgeIdentityPrecheckServiceTest {

    private final AgeIdentityPrecheckService service = new AgeIdentityPrecheckService();
    private final LocalDate today = LocalDate.of(2026, 8, 17);

    @Test
    void adultDateOfBirthPasses() {
        assertThat(service.evaluate(LocalDate.of(2000, 1, 1), today)).isEqualTo(PrecheckStatus.PASS);
    }

    @Test
    void exactlyEighteenYearsOldPasses() {
        assertThat(service.evaluate(today.minusYears(18), today)).isEqualTo(PrecheckStatus.PASS);
    }

    @Test
    void underEighteenReturnsReview() {
        assertThat(service.evaluate(today.minusYears(17), today)).isEqualTo(PrecheckStatus.REVIEW);
    }

    @Test
    void missingDateOfBirthReturnsNeedsInput() {
        assertThat(service.evaluate(null, today)).isEqualTo(PrecheckStatus.NEEDS_INPUT);
    }
}
