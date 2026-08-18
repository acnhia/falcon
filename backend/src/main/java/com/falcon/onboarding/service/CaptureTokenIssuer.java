package com.falcon.onboarding.service;

import com.falcon.onboarding.domain.CaptureToken;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Generates capture-link tokens. The raw token is returned to the caller
 * (used to build the URL and given to the user once) and is never
 * persisted; only its SHA-256 hash is stored, via {@link CaptureToken}.
 */
@Component
public class CaptureTokenIssuer {

    private static final int TOKEN_BYTES = 32;

    private final SecureRandom secureRandom = new SecureRandom();

    public record IssuedToken(String rawToken, CaptureToken storedToken) {
    }

    public IssuedToken issue(String applicationId, Duration expiry) {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        CaptureToken storedToken = new CaptureToken(hash(rawToken), applicationId, Instant.now().plus(expiry));
        return new IssuedToken(rawToken, storedToken);
    }

    public static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 must be available on any supported JDK", e);
        }
    }
}
