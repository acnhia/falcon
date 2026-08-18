package com.falcon.onboarding.validation;

import com.falcon.onboarding.domain.DocumentRecord;
import com.falcon.onboarding.domain.ValidationResult;
import com.falcon.onboarding.domain.ValidationStatus;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Explicit mock: performs no OCR, biometric processing, or external call,
 * and never inspects document content. Deterministically returns
 * {@code VALIDATED} - this is not a real identity/KYC/AML check.
 */
@Component
public class MockDocumentValidationService implements DocumentValidationService {

    @Override
    public ValidationResult validate(DocumentRecord front, DocumentRecord back) {
        return new ValidationResult(ValidationStatus.VALIDATED, Instant.now());
    }
}
