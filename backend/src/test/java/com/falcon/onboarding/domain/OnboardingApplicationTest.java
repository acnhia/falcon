package com.falcon.onboarding.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OnboardingApplicationTest {

    @Test
    void newApplicationStartsInDraftState() {
        OnboardingApplication application = new OnboardingApplication("app-1", "ref-1");

        assertThat(application.status()).isEqualTo(OnboardingStatus.DRAFT);
    }

    @Test
    void issuingCaptureLinkTransitionsDraftToIdentityCaptureRequested() {
        OnboardingApplication application = new OnboardingApplication("app-1", "ref-1");

        application.markCaptureLinkIssued();

        assertThat(application.status()).isEqualTo(OnboardingStatus.IDENTITY_CAPTURE_REQUESTED);
    }

    @Test
    void issuingCaptureLinkTwiceFromCaptureRequestedThrowsIllegalStateTransition() {
        OnboardingApplication application = new OnboardingApplication("app-1", "ref-1");
        application.markCaptureLinkIssued();

        assertThatThrownBy(application::markCaptureLinkIssued)
                .isInstanceOf(IllegalStateTransitionException.class);
    }

    @Test
    void recordingBothDocumentsMarksHasBothSidesTrue() {
        OnboardingApplication application = new OnboardingApplication("app-1", "ref-1");

        application.recordDocument(DocumentSide.FRONT, document(DocumentSide.FRONT));
        assertThat(application.hasBothSides()).isFalse();

        application.recordDocument(DocumentSide.BACK, document(DocumentSide.BACK));
        assertThat(application.hasBothSides()).isTrue();
    }

    @Test
    void claimingValidationBeforeCaptureRequestedThrowsIllegalStateTransition() {
        OnboardingApplication application = new OnboardingApplication("app-1", "ref-1");
        application.recordDocument(DocumentSide.FRONT, document(DocumentSide.FRONT));
        application.recordDocument(DocumentSide.BACK, document(DocumentSide.BACK));

        assertThatThrownBy(application::claimValidationIfReady)
                .isInstanceOf(IllegalStateTransitionException.class);
    }

    @Test
    void claimingValidationBeforeBothSidesReturnsFalseAndDoesNotAdvanceState() {
        OnboardingApplication application = new OnboardingApplication("app-1", "ref-1");
        application.markCaptureLinkIssued();
        application.recordDocument(DocumentSide.FRONT, document(DocumentSide.FRONT));

        assertThat(application.claimValidationIfReady()).isFalse();
        assertThat(application.status()).isEqualTo(OnboardingStatus.IDENTITY_CAPTURE_REQUESTED);
    }

    @Test
    void markingValidatedThenReadyForReviewReachesTerminalState() {
        OnboardingApplication application = new OnboardingApplication("app-1", "ref-1");
        application.markCaptureLinkIssued();
        application.recordDocument(DocumentSide.FRONT, document(DocumentSide.FRONT));
        application.recordDocument(DocumentSide.BACK, document(DocumentSide.BACK));

        assertThat(application.claimValidationIfReady()).isTrue();
        assertThat(application.status()).isEqualTo(OnboardingStatus.IDENTITY_CAPTURED);

        application.markValidated(new ValidationResult(ValidationStatus.VALIDATED, Instant.now()));
        assertThat(application.status()).isEqualTo(OnboardingStatus.IDENTITY_VALIDATED);

        application.markReadyForReview();
        assertThat(application.status()).isEqualTo(OnboardingStatus.READY_FOR_REVIEW);
    }

    @Test
    void concurrentClaimValidationIfReadyOnlyOneCallerWins() throws Exception {
        OnboardingApplication application = new OnboardingApplication("app-1", "ref-1");
        application.markCaptureLinkIssued();
        application.recordDocument(DocumentSide.FRONT, document(DocumentSide.FRONT));
        application.recordDocument(DocumentSide.BACK, document(DocumentSide.BACK));

        int threadCount = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threadCount);
        CountDownLatch ready = new CountDownLatch(threadCount);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<Boolean>> results = new java.util.ArrayList<>();
            for (int i = 0; i < threadCount; i++) {
                results.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    return application.claimValidationIfReady();
                }));
            }
            ready.await();
            go.countDown();

            AtomicInteger winners = new AtomicInteger(0);
            for (Future<Boolean> result : results) {
                if (result.get(5, TimeUnit.SECONDS)) {
                    winners.incrementAndGet();
                }
            }
            assertThat(winners.get()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    private static DocumentRecord document(DocumentSide side) {
        return new DocumentRecord(side, "onboarding/app-1/" + side + "-key.jpg", "image/jpeg", 1024L, "checksum", Instant.now());
    }
}
