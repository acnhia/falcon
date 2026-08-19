package com.falcon.onboarding.service;

import com.falcon.onboarding.config.OnboardingProperties;
import com.falcon.onboarding.domain.CaptureToken;
import com.falcon.onboarding.domain.DocumentRecord;
import com.falcon.onboarding.domain.DocumentSide;
import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.domain.ValidationResult;
import com.falcon.onboarding.exception.ApplicationNotFoundException;
import com.falcon.onboarding.exception.InvalidCaptureLinkException;
import com.falcon.onboarding.repository.CaptureTokenRepository;
import com.falcon.onboarding.repository.OnboardingApplicationRepository;
import com.falcon.onboarding.storage.DocumentStorageClient;
import com.falcon.onboarding.storage.DocumentValidator;
import com.falcon.onboarding.validation.DocumentValidationService;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class DefaultOnboardingOrchestrator implements OnboardingOrchestrator {

    private final OnboardingApplicationRepository applicationRepository;
    private final CaptureTokenRepository tokenRepository;
    private final CaptureTokenIssuer tokenIssuer;
    private final DocumentValidator documentValidator;
    private final DocumentStorageClient storageClient;
    private final DocumentValidationService validationService;
    private final OnboardingProperties properties;

    public DefaultOnboardingOrchestrator(
            OnboardingApplicationRepository applicationRepository,
            CaptureTokenRepository tokenRepository,
            CaptureTokenIssuer tokenIssuer,
            DocumentValidator documentValidator,
            DocumentStorageClient storageClient,
            DocumentValidationService validationService,
            OnboardingProperties properties) {
        this.applicationRepository = applicationRepository;
        this.tokenRepository = tokenRepository;
        this.tokenIssuer = tokenIssuer;
        this.documentValidator = documentValidator;
        this.storageClient = storageClient;
        this.validationService = validationService;
        this.properties = properties;
    }

    @Override
    public OnboardingApplication createApplication() {
        OnboardingApplication application = new OnboardingApplication(
                UUID.randomUUID().toString(), UUID.randomUUID().toString());
        applicationRepository.save(application);
        return application;
    }

    @Override
    public OnboardingApplication getApplicationByPublicReference(String publicReference) {
        return applicationRepository.findByPublicReference(publicReference)
                .orElseThrow(() -> new ApplicationNotFoundException(publicReference));
    }

    @Override
    public CaptureLink issueCaptureLink(String publicReference) {
        OnboardingApplication application = getApplicationByPublicReference(publicReference);
        CaptureTokenIssuer.IssuedToken issued = tokenIssuer.issue(
                application.id(), Duration.ofMinutes(properties.captureLinkExpiryMinutes()));

        tokenRepository.save(issued.storedToken());
        application.markCaptureLinkIssued();
        applicationRepository.save(application);

        return new CaptureLink(issued.rawToken(), issued.storedToken().expiresAt());
    }

    @Override
    public CaptureContext getCaptureContext(String rawToken) {
        CaptureToken token = resolveActiveToken(rawToken);
        OnboardingApplication application = findApplicationOrInvalidLink(token.applicationId());

        boolean front = hasSide(application, DocumentSide.FRONT);
        boolean back = hasSide(application, DocumentSide.BACK);
        return new CaptureContext(front, back, application.status().name());
    }

    @Override
    public OnboardingApplication uploadDocument(String rawToken, DocumentSide side, byte[] content, String contentType) {
        CaptureToken token = resolveActiveToken(rawToken);
        OnboardingApplication application = findApplicationOrInvalidLink(token.applicationId());

        documentValidator.validate(content, contentType);

        String objectKey = buildObjectKey(application.id(), side, contentType);
        storageClient.putObject(objectKey, content, contentType);

        DocumentRecord record = new DocumentRecord(
                side, objectKey, contentType, content.length, checksum(content), Instant.now());
        application.recordDocument(side, record);
        applicationRepository.save(application);

        if (application.claimValidationIfReady()) {
            token.tryConsume();
            DocumentRecord front = documentBySide(application, DocumentSide.FRONT);
            DocumentRecord back = documentBySide(application, DocumentSide.BACK);
            ValidationResult result = validationService.validate(front, back);
            application.markValidated(result);
            application.markReadyForReview();
            applicationRepository.save(application);
        }

        return application;
    }

    private CaptureToken resolveActiveToken(String rawToken) {
        String hash = CaptureTokenIssuer.hash(rawToken);
        CaptureToken token = tokenRepository.findByHash(hash).orElseThrow(InvalidCaptureLinkException::new);
        if (token.isExpired(Instant.now()) || token.isConsumed()) {
            throw new InvalidCaptureLinkException();
        }
        return token;
    }

    private OnboardingApplication findApplicationOrInvalidLink(String applicationId) {
        return applicationRepository.findById(applicationId).orElseThrow(InvalidCaptureLinkException::new);
    }

    private static boolean hasSide(OnboardingApplication application, DocumentSide side) {
        return application.documents().stream().anyMatch(d -> d.side() == side);
    }

    private static DocumentRecord documentBySide(OnboardingApplication application, DocumentSide side) {
        return application.documents().stream()
                .filter(d -> d.side() == side)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Expected a stored " + side + " document"));
    }

    private String buildObjectKey(String applicationId, DocumentSide side, String contentType) {
        return "%s/%s/%s-%s.%s".formatted(
                properties.storagePrefix(), applicationId, side.name().toLowerCase(), UUID.randomUUID(),
                extensionFor(contentType));
    }

    private static String extensionFor(String contentType) {
        int separator = contentType.indexOf(';');
        String baseType = (separator == -1 ? contentType : contentType.substring(0, separator)).trim();
        return switch (baseType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "bin";
        };
    }

    private static String checksum(byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(content));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 must be available on any supported JDK", e);
        }
    }
}
