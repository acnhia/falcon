package com.falcon.onboarding.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EnumFieldValuesTest {

    @Test
    void suffixAllowsOnlyTheObservedBrokerageOptions() {
        assertThat(EnumFieldValues.allowedValuesFor("suffix")).containsExactlyInAnyOrder(
                "JR", "SR", "I", "II", "III", "IV");
    }

    @Test
    void maritalStatusAllowsTheFourStandardCodes() {
        assertThat(EnumFieldValues.allowedValuesFor("maritalStatus")).containsExactlyInAnyOrder(
                "SINGLE", "MARRIED", "DIVORCED", "WIDOWED");
    }

    @Test
    void citizenshipAllowsTheThreeStandardCodes() {
        assertThat(EnumFieldValues.allowedValuesFor("citizenship")).containsExactlyInAnyOrder(
                "US_CITIZEN", "RESIDENT_ALIEN", "NON_RESIDENT_ALIEN");
    }

    @Test
    void residentialStateAndMailingStateShareTheFiftyOneStateAndTerritoryCodes() {
        assertThat(EnumFieldValues.allowedValuesFor("residentialState")).hasSize(52).contains("CA", "NY", "DC", "PR");
        assertThat(EnumFieldValues.allowedValuesFor("mailingState")).isEqualTo(EnumFieldValues.allowedValuesFor("residentialState"));
    }

    @Test
    void unknownFieldKeyHasNoAllowlist() {
        assertThat(EnumFieldValues.allowedValuesFor("legalFirstName")).isNull();
    }
}
