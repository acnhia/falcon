package com.falcon.onboarding.repository.jdbc;

import com.falcon.onboarding.domain.DocumentRecord;
import com.falcon.onboarding.domain.DocumentSide;
import com.falcon.onboarding.domain.OnboardingApplication;
import com.falcon.onboarding.domain.OnboardingStatus;
import com.falcon.onboarding.repository.OnboardingApplicationRepository;
import com.falcon.upload.UploadDemoApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = UploadDemoApplication.class)
class JdbcOnboardingApplicationRepositoryTest {

    @Autowired
    private OnboardingApplicationRepository repository;

    @Test
    void savedApplicationIsFindableByIdAndByPublicReferenceWithMatchingFields() {
        String id = UUID.randomUUID().toString();
        String publicReference = UUID.randomUUID().toString();
        OnboardingApplication application = new OnboardingApplication(id, publicReference);

        repository.save(application);

        OnboardingApplication byId = repository.findById(id).orElseThrow();
        assertThat(byId.publicReference()).isEqualTo(publicReference);
        assertThat(byId.status()).isEqualTo(OnboardingStatus.DRAFT);

        OnboardingApplication byReference = repository.findByPublicReference(publicReference).orElseThrow();
        assertThat(byReference.id()).isEqualTo(id);
    }

    @Test
    void unknownIdAndPublicReferenceReturnEmpty() {
        assertThat(repository.findById("not-a-real-id")).isEmpty();
        assertThat(repository.findByPublicReference("not-a-real-reference")).isEmpty();
    }

    @Test
    void statusAndDocumentsRoundTripAcrossSaves() {
        String id = UUID.randomUUID().toString();
        OnboardingApplication application = new OnboardingApplication(id, UUID.randomUUID().toString());
        repository.save(application);

        application.markCaptureLinkIssued();
        DocumentRecord front = new DocumentRecord(DocumentSide.FRONT, "onboarding/" + id + "/front.jpg",
                "image/jpeg", 1024L, "checksum-front", Instant.now());
        application.recordDocument(DocumentSide.FRONT, front);
        repository.save(application);

        OnboardingApplication reloaded = repository.findById(id).orElseThrow();
        assertThat(reloaded.status()).isEqualTo(OnboardingStatus.IDENTITY_CAPTURE_REQUESTED);
        assertThat(reloaded.documents()).hasSize(1);
        assertThat(reloaded.documents().iterator().next().objectKey()).isEqualTo(front.objectKey());
        assertThat(reloaded.hasBothSides()).isFalse();
    }
}
