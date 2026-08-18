package com.falcon.onboarding.storage;

import com.falcon.onboarding.config.OnboardingProperties;
import com.falcon.onboarding.exception.DocumentValidationException;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

class DocumentValidatorTest {

    private final OnboardingProperties properties =
            new OnboardingProperties(15, "onboarding", 1_000_000L, 4096, "http://localhost:5173");
    private final DocumentValidator validator = new DocumentValidator(properties);

    @Test
    void acceptsValidJpegWithinSizeLimit() {
        byte[] jpeg = syntheticJpeg(10, 10);

        assertThatCode(() -> validator.validate(jpeg, "image/jpeg")).doesNotThrowAnyException();
    }

    @Test
    void rejectsEmptyContent() {
        assertThatThrownBy(() -> validator.validate(new byte[0], "image/jpeg"))
                .isInstanceOf(DocumentValidationException.class);
    }

    @Test
    void rejectsNullContent() {
        assertThatThrownBy(() -> validator.validate(null, "image/jpeg"))
                .isInstanceOf(DocumentValidationException.class);
    }

    @Test
    void rejectsContentOverConfiguredSizeLimit() {
        OnboardingProperties tinyLimit = new OnboardingProperties(15, "onboarding", 10L, 4096, "http://localhost:5173");
        DocumentValidator strictValidator = new DocumentValidator(tinyLimit);
        byte[] jpeg = syntheticJpeg(10, 10);

        assertThatThrownBy(() -> strictValidator.validate(jpeg, "image/jpeg"))
                .isInstanceOf(DocumentValidationException.class);
    }

    @Test
    void rejectsUnsupportedDeclaredMimeType() {
        byte[] jpeg = syntheticJpeg(10, 10);

        assertThatThrownBy(() -> validator.validate(jpeg, "image/gif"))
                .isInstanceOf(DocumentValidationException.class);
    }

    @Test
    void rejectsContentThatFailsToDecodeAsAnImage() {
        byte[] garbage = "not an image".getBytes();

        assertThatThrownBy(() -> validator.validate(garbage, "image/jpeg"))
                .isInstanceOf(DocumentValidationException.class);
    }

    @Test
    void rejectsImageExceedingConfiguredMaxDimension() {
        OnboardingProperties smallMaxDimension = new OnboardingProperties(15, "onboarding", 1_000_000L, 20, "http://localhost:5173");
        DocumentValidator strictValidator = new DocumentValidator(smallMaxDimension);
        byte[] jpeg = syntheticJpeg(50, 50);

        assertThatThrownBy(() -> strictValidator.validate(jpeg, "image/jpeg"))
                .isInstanceOf(DocumentValidationException.class);
    }

    private static byte[] syntheticJpeg(int width, int height) {
        try {
            BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "jpg", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
