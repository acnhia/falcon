package com.falcon.onboarding.storage;

import com.falcon.onboarding.config.OnboardingProperties;
import com.falcon.onboarding.exception.DocumentValidationException;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Set;

/**
 * Validates a document image before it is ever handed to storage. Checks
 * run cheapest-first: size, then declared MIME type, then an actual
 * image-decode (catches mislabeled/corrupt content that a MIME check alone
 * would miss), then pixel dimensions.
 */
@Component
public class DocumentValidator {

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final OnboardingProperties properties;

    public DocumentValidator(OnboardingProperties properties) {
        this.properties = properties;
    }

    public void validate(byte[] content, String declaredContentType) {
        if (content == null || content.length == 0) {
            throw new DocumentValidationException("Document content must not be empty");
        }
        if (content.length > properties.maxDocumentBytes()) {
            throw new DocumentValidationException(
                    "Document exceeds the maximum allowed size of " + properties.maxDocumentBytes() + " bytes");
        }
        if (declaredContentType == null || !ALLOWED_MIME_TYPES.contains(baseType(declaredContentType))) {
            throw new DocumentValidationException("Unsupported content type: " + declaredContentType);
        }

        BufferedImage decoded;
        try {
            decoded = ImageIO.read(new ByteArrayInputStream(content));
        } catch (IOException e) {
            throw new DocumentValidationException("Unable to decode image content");
        }
        if (decoded == null) {
            throw new DocumentValidationException("Unable to decode image content");
        }
        if (decoded.getWidth() > properties.maxImageDimensionPx() || decoded.getHeight() > properties.maxImageDimensionPx()) {
            throw new DocumentValidationException(
                    "Image dimensions exceed the maximum allowed pixel size of " + properties.maxImageDimensionPx());
        }
    }

    /** Strips any {@code ;charset=...}-style parameter a client may send alongside the MIME type. */
    private static String baseType(String contentType) {
        int separator = contentType.indexOf(';');
        return (separator == -1 ? contentType : contentType.substring(0, separator)).trim();
    }
}
