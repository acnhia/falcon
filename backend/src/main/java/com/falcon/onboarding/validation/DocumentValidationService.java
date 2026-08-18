package com.falcon.onboarding.validation;

import com.falcon.onboarding.domain.DocumentRecord;
import com.falcon.onboarding.domain.ValidationResult;

/**
 * Port for identity-document validation. A future real provider is a second
 * implementation of this interface, selected by configuration - this slice
 * only ships {@link MockDocumentValidationService}.
 */
public interface DocumentValidationService {
    ValidationResult validate(DocumentRecord front, DocumentRecord back);
}
