package com.falcon.onboarding.domain;

import java.util.Map;
import java.util.Set;

/**
 * Allowed-value lists for the activity-3 fields typed {@link FieldDataType#ENUM}.
 * There is no {@code allowed_values} column on {@code field_definition} - this
 * stays a small, local constant rather than a schema change, kept narrow to
 * just the new enum-typed fields introduced alongside it.
 */
public final class EnumFieldValues {

    private static final Set<String> SUFFIXES = Set.of("JR", "SR", "I", "II", "III", "IV");

    private static final Set<String> US_STATES = Set.of(
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
            "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
            "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
            "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
            "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
            "DC", "PR");

    private static final Set<String> MARITAL_STATUSES = Set.of("SINGLE", "MARRIED", "DIVORCED", "WIDOWED");

    private static final Set<String> CITIZENSHIP_STATUSES = Set.of("US_CITIZEN", "RESIDENT_ALIEN", "NON_RESIDENT_ALIEN");

    private static final Set<String> EMPLOYMENT_STATUSES = Set.of(
            "EMPLOYED", "SELF_EMPLOYED", "RETIRED", "STUDENT", "HOMEMAKER", "UNEMPLOYED");

    /** Shared coarse-range buckets for income/net-worth/liquid-net-worth - "coarse synthetic ranges instead of exact sensitive financial values" per docs/06. */
    private static final Set<String> MONEY_RANGES = Set.of(
            "UNDER_25K", "FROM_25K_TO_50K", "FROM_50K_TO_100K", "FROM_100K_TO_200K", "FROM_200K_TO_500K", "OVER_500K");

    private static final Set<String> TAX_BRACKET_RANGES = Set.of("LOW", "MODERATE", "HIGH", "HIGHEST");

    /**
     * The reference brokerage's real form allows multiple sources of funds; simplified to a
     * single-select here since this codebase's field values are flat strings
     * with no array/multi-select support yet - a documented scope reduction.
     */
    private static final Set<String> SOURCE_OF_FUNDS = Set.of(
            "EMPLOYMENT_INCOME", "INVESTMENTS", "INHERITANCE", "RETIREMENT_SAVINGS", "BUSINESS_INCOME", "OTHER");

    private static final Set<String> INVESTMENT_OBJECTIVES = Set.of(
            "INCOME", "GROWTH", "GROWTH_AND_INCOME", "SPECULATION", "CAPITAL_PRESERVATION");

    private static final Set<String> RISK_TOLERANCES = Set.of("CONSERVATIVE", "MODERATE", "AGGRESSIVE");

    /** Simplified to one overall experience level rather than the reference brokerage's per-product (stocks/bonds/options/etc.) breakdown. */
    private static final Set<String> INVESTMENT_EXPERIENCES = Set.of("NONE", "LIMITED", "GOOD", "EXTENSIVE");

    private static final Set<String> TIME_HORIZONS = Set.of("SHORT_TERM", "MEDIUM_TERM", "LONG_TERM");

    private static final Set<String> DELIVERY_PREFERENCES = Set.of("E_DELIVERY", "PAPER");

    private static final Set<String> COST_BASIS_METHODS = Set.of(
            "FIFO", "LIFO", "SPECIFIC_IDENTIFICATION", "AVERAGE_COST");

    private static final Map<String, Set<String>> BY_FIELD_KEY = Map.ofEntries(
            Map.entry("suffix", SUFFIXES),
            Map.entry("residentialState", US_STATES),
            Map.entry("mailingState", US_STATES),
            Map.entry("maritalStatus", MARITAL_STATUSES),
            Map.entry("citizenship", CITIZENSHIP_STATUSES),
            Map.entry("employmentStatus", EMPLOYMENT_STATUSES),
            Map.entry("annualIncomeRange", MONEY_RANGES),
            Map.entry("netWorthRange", MONEY_RANGES),
            Map.entry("liquidNetWorthRange", MONEY_RANGES),
            Map.entry("taxBracketRange", TAX_BRACKET_RANGES),
            Map.entry("sourceOfFunds", SOURCE_OF_FUNDS),
            Map.entry("investmentObjective", INVESTMENT_OBJECTIVES),
            Map.entry("riskTolerance", RISK_TOLERANCES),
            Map.entry("investmentExperience", INVESTMENT_EXPERIENCES),
            Map.entry("timeHorizon", TIME_HORIZONS),
            Map.entry("deliveryPreference", DELIVERY_PREFERENCES),
            Map.entry("costBasisMethod", COST_BASIS_METHODS));

    private EnumFieldValues() {
    }

    /** Null for a field key with no enum allowlist (i.e. not an ENUM-typed field this class knows about). */
    public static Set<String> allowedValuesFor(String fieldKey) {
        return BY_FIELD_KEY.get(fieldKey);
    }
}
