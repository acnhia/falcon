package com.falcon.onboarding.contract;

import com.falcon.onboarding.domain.EnumFieldValues;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Parity between this reference implementation and {@code backend/contracts}. The edge worker - the
 * canonical production runtime - has an equivalent suite, so the shared contract is enforced on both
 * sides in code rather than maintained by discipline. This closes the drift risk the code-standards
 * review raised as its most important open finding.
 *
 * <p>The contract is parsed with a small regex reader rather than a JSON library so this test adds no
 * dependency to the service purely for its own benefit.
 */
class OnboardingContractParityTest {

    private static final Path CONTRACT = Path.of("../contracts/onboarding-field-catalogue.json");

    @Test
    void everyControlledSelectionFieldInTheContractHasAnAllowlistHere() throws IOException {
        for (Map.Entry<String, Set<String>> field : contractEnumFields().entrySet()) {
            assertThat(EnumFieldValues.allowedValuesFor(field.getKey()))
                    .as("no allowlist implemented for '%s'", field.getKey())
                    .isNotEmpty();
        }
    }

    @Test
    void acceptsExactlyTheValuesTheContractPermits() throws IOException {
        for (Map.Entry<String, Set<String>> field : contractEnumFields().entrySet()) {
            assertThat(new TreeSet<>(EnumFieldValues.allowedValuesFor(field.getKey())))
                    .as("allowed values for '%s' drifted from the contract", field.getKey())
                    .isEqualTo(new TreeSet<>(field.getValue()));
        }
    }

    @Test
    void theContractIsReachableAndNonEmpty() throws IOException {
        assertThat(CONTRACT).as("contract file is missing - check the relative path").exists();
        assertThat(contractEnumFields()).as("contract declares no controlled-selection fields").isNotEmpty();
    }

    /** field key -> allowed values, for every field the contract types as ENUM. */
    private Map<String, Set<String>> contractEnumFields() throws IOException {
        String json = Files.readString(CONTRACT);
        Map<String, Set<String>> fields = new LinkedHashMap<>();
        // [^}]*? rather than .*? so a match cannot span from one field object into the next -
        // otherwise a STRING field can be paired with a later field's allowedValues.
        Matcher entry = Pattern
                .compile("\\{\\s*\"key\":\\s*\"(\\w+)\"[^}]*?\"type\":\\s*\"ENUM\"[^}]*?\"allowedValues\":\\s*\\[([^]]*)]",
                        Pattern.DOTALL)
                .matcher(json);
        while (entry.find()) {
            Matcher value = Pattern.compile("\"([^\"]+)\"").matcher(entry.group(2));
            List<String> values = new ArrayList<>();
            while (value.find()) {
                values.add(value.group(1));
            }
            fields.put(entry.group(1), Set.copyOf(values));
        }
        return fields;
    }
}
