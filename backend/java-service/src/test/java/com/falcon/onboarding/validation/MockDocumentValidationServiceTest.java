package com.falcon.onboarding.validation;

import com.falcon.onboarding.domain.DocumentRecord;
import com.falcon.onboarding.domain.DocumentSide;
import com.falcon.onboarding.domain.ValidationStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class MockDocumentValidationServiceTest {

    private final MockDocumentValidationService service = new MockDocumentValidationService();

    @Test
    void returnsValidatedDeterministicallyRegardlessOfDocumentContent() {
        DocumentRecord frontA = document(DocumentSide.FRONT, "front-a-key");
        DocumentRecord backA = document(DocumentSide.BACK, "back-a-key");
        DocumentRecord frontB = document(DocumentSide.FRONT, "front-b-key");
        DocumentRecord backB = document(DocumentSide.BACK, "back-b-key");

        assertThat(service.validate(frontA, backA).status()).isEqualTo(ValidationStatus.VALIDATED);
        assertThat(service.validate(frontB, backB).status()).isEqualTo(ValidationStatus.VALIDATED);
    }

    private static DocumentRecord document(DocumentSide side, String key) {
        return new DocumentRecord(side, key, "image/jpeg", 1024L, "checksum", Instant.now());
    }
}
