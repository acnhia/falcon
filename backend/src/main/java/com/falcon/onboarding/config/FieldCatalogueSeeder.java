package com.falcon.onboarding.config;

import com.falcon.onboarding.domain.FieldDataType;
import com.falcon.onboarding.domain.FieldDefinition;
import com.falcon.onboarding.repository.FieldDefinitionRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

/**
 * Seeds the activity-3 (personal information) field catalogue - the only
 * field-definition-driven activity built so far. Idempotent: {@link
 * FieldDefinitionRepository#seed} skips a field key that already exists.
 */
@Component
public class FieldCatalogueSeeder {

    private static final int PERSONAL_INFORMATION_ACTIVITY = 3;
    private static final int SCHEMA_VERSION = 1;

    private final FieldDefinitionRepository repository;

    public FieldCatalogueSeeder(FieldDefinitionRepository repository) {
        this.repository = repository;
    }

    @PostConstruct
    void seed() {
        seed("legalFirstName", FieldDataType.STRING, true);
        seed("legalLastName", FieldDataType.STRING, true);
        seed("dateOfBirth", FieldDataType.DATE, true);
        seed("email", FieldDataType.EMAIL, true);
        seed("residentialCountry", FieldDataType.COUNTRY, true);
        seed("preferredFirstName", FieldDataType.STRING, false);
        seed("preferredLastName", FieldDataType.STRING, false);
        seed("phone", FieldDataType.PHONE, true);

        // Added to make the form match a real brokerage account-opening form's
        // fields (see account_opening_fields.md), folded into this
        // same screen/activity by deliberate scope decision - see context.md.
        seed("middleName", FieldDataType.STRING, false);
        seed("suffix", FieldDataType.ENUM, false);
        seed("residentialAddressLine1", FieldDataType.STRING, true);
        seed("residentialAddressLine2", FieldDataType.STRING, false);
        seed("residentialCity", FieldDataType.STRING, true);
        seed("residentialState", FieldDataType.ENUM, true);
        seed("residentialPostalCode", FieldDataType.STRING, true);
        seed("hasMailingAddress", FieldDataType.BOOLEAN, false);
        seed("mailingAddressLine1", FieldDataType.STRING, false);
        seed("mailingAddressLine2", FieldDataType.STRING, false);
        seed("mailingCity", FieldDataType.STRING, false);
        seed("mailingState", FieldDataType.ENUM, false);
        seed("mailingPostalCode", FieldDataType.STRING, false);
        seed("maritalStatus", FieldDataType.ENUM, true);
        seed("citizenship", FieldDataType.ENUM, true);
        seed("isBrokerDealerAffiliated", FieldDataType.BOOLEAN, true);
        seed("brokerDealerFirmName", FieldDataType.STRING, false);
        seed("isControlPerson", FieldDataType.BOOLEAN, true);
        seed("controlPersonCompany", FieldDataType.STRING, false);
        seed("isPoliticallyExposedPerson", FieldDataType.BOOLEAN, true);
        seed("hasOtherBrokerageAccounts", FieldDataType.BOOLEAN, false);

        // The reference brokerage's Section 2 (Employment & finances) and Section 4
        // (Additional details) - completing the field set alongside Section 1
        // and the regulatory questions above. Employer address is simplified
        // to one line (not a full street/city/state/ZIP group), source of
        // funds and account features are single-select/individual booleans
        // rather than multi-select (no array-value support in this schema),
        // and investment experience is one overall level rather than
        // The reference brokerage's per-product breakdown - documented scope reductions.
        seed("employmentStatus", FieldDataType.ENUM, true);
        seed("employerName", FieldDataType.STRING, false);
        seed("occupation", FieldDataType.STRING, false);
        seed("employerAddress", FieldDataType.STRING, false);
        seed("yearsWithEmployer", FieldDataType.STRING, false);
        seed("annualIncomeRange", FieldDataType.ENUM, true);
        seed("netWorthRange", FieldDataType.ENUM, true);
        seed("liquidNetWorthRange", FieldDataType.ENUM, true);
        seed("taxBracketRange", FieldDataType.ENUM, false);
        seed("sourceOfFunds", FieldDataType.ENUM, true);
        seed("investmentObjective", FieldDataType.ENUM, true);
        seed("riskTolerance", FieldDataType.ENUM, true);
        seed("investmentExperience", FieldDataType.ENUM, true);
        seed("timeHorizon", FieldDataType.ENUM, true);
        seed("trustedContactName", FieldDataType.STRING, false);
        seed("trustedContactPhone", FieldDataType.PHONE, false);
        seed("trustedContactEmail", FieldDataType.EMAIL, false);
        seed("trustedContactRelationship", FieldDataType.STRING, false);
        seed("wantsMarginAccount", FieldDataType.BOOLEAN, false);
        seed("wantsOptionsTrading", FieldDataType.BOOLEAN, false);
        seed("wantsDividendReinvestment", FieldDataType.BOOLEAN, false);
        seed("deliveryPreference", FieldDataType.ENUM, true);
        seed("costBasisMethod", FieldDataType.ENUM, false);
        seed("w9Certification", FieldDataType.BOOLEAN, true);
        seed("esignatureConsent", FieldDataType.BOOLEAN, true);
    }

    private void seed(String fieldKey, FieldDataType dataType, boolean required) {
        repository.seed(new FieldDefinition(fieldKey, PERSONAL_INFORMATION_ACTIVITY, dataType, required, SCHEMA_VERSION));
    }
}
