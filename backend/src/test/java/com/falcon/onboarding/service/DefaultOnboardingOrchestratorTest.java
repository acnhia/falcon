package com.falcon.onboarding.service;

import com.falcon.onboarding.config.OnboardingProperties;
import com.falcon.onboarding.domain.DocumentSide;
import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.domain.OnboardingStatus;
import com.falcon.onboarding.exception.InvalidCaptureLinkException;
import com.falcon.onboarding.repository.InMemoryCaptureTokenRepository;
import com.falcon.onboarding.repository.InMemoryOnboardingApplicationRepository;
import com.falcon.onboarding.storage.DocumentStorageClient;
import com.falcon.onboarding.storage.DocumentValidator;
import com.falcon.onboarding.validation.MockDocumentValidationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DefaultOnboardingOrchestratorTest {

    private InMemoryOnboardingApplicationRepository applicationRepository;
    private InMemoryCaptureTokenRepository tokenRepository;
    private RecordingStorageClient storageClient;
    private DefaultOnboardingOrchestrator orchestrator;

    @BeforeEach
    void setUp() {
        applicationRepository = new InMemoryOnboardingApplicationRepository();
        tokenRepository = new InMemoryCaptureTokenRepository();
        storageClient = new RecordingStorageClient();
        OnboardingProperties properties =
                new OnboardingProperties(15, "onboarding", 1_000_000L, 4096, "http://localhost:5173");
        orchestrator = new DefaultOnboardingOrchestrator(
                applicationRepository,
                tokenRepository,
                new CaptureTokenIssuer(),
                new DocumentValidator(properties),
                storageClient,
                new MockDocumentValidationService(),
                properties);
    }

    @Test
    void creatingApplicationReturnsDraftStatusAndOpaquePublicReference() {
        OnboardingApplication application = orchestrator.createApplication();

        assertThat(application.status()).isEqualTo(OnboardingStatus.DRAFT);
        assertThat(application.publicReference()).isNotBlank();
        assertThat(application.publicReference()).isNotEqualTo(application.id());
    }

    @Test
    void issuingCaptureLinkReturnsRawTokenNotStoredHash() {
        OnboardingApplication application = orchestrator.createApplication();

        OnboardingOrchestrator.CaptureLink link = orchestrator.issueCaptureLink(application.publicReference());

        assertThat(link.rawToken()).isNotBlank();
        assertThat(CaptureTokenIssuer.hash(link.rawToken())).isNotEqualTo(link.rawToken());
        assertThat(orchestrator.getApplicationByPublicReference(application.publicReference()).status())
                .isEqualTo(OnboardingStatus.IDENTITY_CAPTURE_REQUESTED);
    }

    @Test
    void resolvingUnknownTokenThrowsInvalidCaptureLinkException() {
        assertThatThrownBy(() -> orchestrator.getCaptureContext("not-a-real-token"))
                .isInstanceOf(InvalidCaptureLinkException.class);
    }

    @Test
    void resolvingExpiredTokenThrowsInvalidCaptureLinkException() {
        OnboardingApplication application = orchestrator.createApplication();
        OnboardingOrchestrator.CaptureLink link = orchestrator.issueCaptureLink(application.publicReference());
        // Force expiry by re-saving an already-expired token under the same hash.
        String hash = CaptureTokenIssuer.hash(link.rawToken());
        tokenRepository.save(new com.falcon.onboarding.domain.CaptureToken(
                hash, application.id(), Instant.now().minusSeconds(1)));

        assertThatThrownBy(() -> orchestrator.getCaptureContext(link.rawToken()))
                .isInstanceOf(InvalidCaptureLinkException.class);
    }

    @Test
    void uploadingFrontThenBackTriggersMockValidationAndTransitionsToReadyForReview() {
        OnboardingApplication application = orchestrator.createApplication();
        OnboardingOrchestrator.CaptureLink link = orchestrator.issueCaptureLink(application.publicReference());

        orchestrator.uploadDocument(link.rawToken(), DocumentSide.FRONT, syntheticJpeg(), "image/jpeg");
        assertThat(orchestrator.getApplicationByPublicReference(application.publicReference()).status())
                .isEqualTo(OnboardingStatus.IDENTITY_CAPTURE_REQUESTED);

        OnboardingApplication afterBack = orchestrator.uploadDocument(
                link.rawToken(), DocumentSide.BACK, syntheticJpeg(), "image/jpeg");

        assertThat(afterBack.status()).isEqualTo(OnboardingStatus.READY_FOR_REVIEW);
        assertThat(storageClient.putCount()).isEqualTo(2);
    }

    @Test
    void tokenIsConsumedOnlyAfterSecondSideAccepted() {
        OnboardingApplication application = orchestrator.createApplication();
        OnboardingOrchestrator.CaptureLink link = orchestrator.issueCaptureLink(application.publicReference());

        orchestrator.uploadDocument(link.rawToken(), DocumentSide.FRONT, syntheticJpeg(), "image/jpeg");
        // Token still valid: re-reading capture context with the same token must not fail.
        assertThat(orchestrator.getCaptureContext(link.rawToken()).frontCaptured()).isTrue();

        orchestrator.uploadDocument(link.rawToken(), DocumentSide.BACK, syntheticJpeg(), "image/jpeg");

        assertThatThrownBy(() -> orchestrator.getCaptureContext(link.rawToken()))
                .isInstanceOf(InvalidCaptureLinkException.class);
    }

    @Test
    void storedDocumentRecordNeverCarriesPiiFields() {
        OnboardingApplication application = orchestrator.createApplication();
        OnboardingOrchestrator.CaptureLink link = orchestrator.issueCaptureLink(application.publicReference());

        OnboardingApplication after = orchestrator.uploadDocument(
                link.rawToken(), DocumentSide.FRONT, syntheticJpeg(), "image/jpeg");

        List<String> fieldNames = java.util.Arrays.stream(
                        com.falcon.onboarding.domain.DocumentRecord.class.getRecordComponents())
                .map(c -> c.getName())
                .toList();
        assertThat(fieldNames).containsExactlyInAnyOrder(
                "side", "objectKey", "mimeType", "byteSize", "checksum", "capturedAt");
        assertThat(after.documents()).allSatisfy(record -> {
            assertThat(record.objectKey()).doesNotContain(application.publicReference());
        });
    }

    @Test
    void concurrentUploadOfBothSidesOnlyTriggersValidationOnce() throws Exception {
        AtomicInteger validationInvocations = new AtomicInteger(0);
        OnboardingProperties properties =
                new OnboardingProperties(15, "onboarding", 1_000_000L, 4096, "http://localhost:5173");
        DefaultOnboardingOrchestrator countingOrchestrator = new DefaultOnboardingOrchestrator(
                applicationRepository,
                tokenRepository,
                new CaptureTokenIssuer(),
                new DocumentValidator(properties),
                storageClient,
                (front, back) -> {
                    validationInvocations.incrementAndGet();
                    return new com.falcon.onboarding.domain.ValidationResult(
                            com.falcon.onboarding.domain.ValidationStatus.VALIDATED, Instant.now());
                },
                properties);

        OnboardingApplication application = countingOrchestrator.createApplication();
        OnboardingOrchestrator.CaptureLink link = countingOrchestrator.issueCaptureLink(application.publicReference());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            Future<OnboardingApplication> frontUpload = pool.submit(() -> {
                ready.countDown();
                go.await();
                return countingOrchestrator.uploadDocument(link.rawToken(), DocumentSide.FRONT, syntheticJpeg(), "image/jpeg");
            });
            Future<OnboardingApplication> backUpload = pool.submit(() -> {
                ready.countDown();
                go.await();
                return countingOrchestrator.uploadDocument(link.rawToken(), DocumentSide.BACK, syntheticJpeg(), "image/jpeg");
            });
            ready.await();
            go.countDown();

            frontUpload.get(5, TimeUnit.SECONDS);
            backUpload.get(5, TimeUnit.SECONDS);

            assertThat(validationInvocations.get()).isEqualTo(1);
            assertThat(countingOrchestrator.getApplicationByPublicReference(application.publicReference()).status())
                    .isEqualTo(OnboardingStatus.READY_FOR_REVIEW);
        } finally {
            pool.shutdownNow();
        }
    }

    private static byte[] syntheticJpeg() {
        try {
            BufferedImage image = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "jpg", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static final class RecordingStorageClient implements DocumentStorageClient {
        private final Map<String, byte[]> objects = new ConcurrentHashMap<>();

        @Override
        public void putObject(String objectKey, byte[] content, String contentType) {
            objects.put(objectKey, content);
        }

        @Override
        public byte[] getObject(String objectKey) {
            return objects.get(objectKey);
        }

        int putCount() {
            return objects.size();
        }
    }
}
