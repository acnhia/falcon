package com.falcon.onboarding.workflow;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.Period;

/**
 * Explicit mock: activity 4 in 05-wizard-data-and-services.md. Performs no
 * external call and inspects only the synthetic date of birth already
 * collected in activity 3 - this is not a real age/identity verification.
 */
@Component
public class AgeIdentityPrecheckService {

    private static final int MINIMUM_AGE = 18;

    public PrecheckStatus evaluate(LocalDate dateOfBirth, LocalDate today) {
        if (dateOfBirth == null) {
            return PrecheckStatus.NEEDS_INPUT;
        }
        int age = Period.between(dateOfBirth, today).getYears();
        return age >= MINIMUM_AGE ? PrecheckStatus.PASS : PrecheckStatus.REVIEW;
    }
}
