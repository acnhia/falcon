package com.falcon.upload.storage;

import com.falcon.upload.config.R2Properties;
import com.falcon.upload.domain.PartResult;
import com.falcon.upload.exception.StorageException;
import java.io.InputStream;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.AbortMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CompleteMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CompletedMultipartUpload;
import software.amazon.awssdk.services.s3.model.CompletedPart;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.UploadPartRequest;
import software.amazon.awssdk.services.s3.model.UploadPartResponse;

/**
 * The one place in the codebase that knows about the AWS S3 SDK and R2's
 * S3-compatible API. Everything else talks to {@link ObjectStorageClient}.
 */
@Component
public class CloudflareR2StorageClient implements ObjectStorageClient {

    private final S3Client s3Client;
    private final String bucket;

    public CloudflareR2StorageClient(R2Properties properties) {
        this.bucket = properties.bucket();
        this.s3Client = S3Client.builder()
                .endpointOverride(java.net.URI.create(properties.endpoint()))
                .region(Region.of("auto"))
                .forcePathStyle(true)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(properties.accessKey(), properties.secretKey())))
                .build();
    }

    @Override
    public String createMultipartUpload(String objectKey) {
        try {
            return s3Client.createMultipartUpload(CreateMultipartUploadRequest.builder()
                            .bucket(bucket)
                            .key(objectKey)
                            .build())
                    .uploadId();
        } catch (S3Exception e) {
            throw new StorageException("Failed to create multipart upload for " + objectKey, e);
        }
    }

    @Override
    public PartResult uploadPart(String objectKey, String uploadId, int partNumber, InputStream body, long contentLength) {
        try {
            UploadPartResponse response = s3Client.uploadPart(
                    UploadPartRequest.builder()
                            .bucket(bucket)
                            .key(objectKey)
                            .uploadId(uploadId)
                            .partNumber(partNumber)
                            .contentLength(contentLength)
                            .build(),
                    RequestBody.fromInputStream(body, contentLength));
            return new PartResult(partNumber, response.eTag(), contentLength, Instant.now());
        } catch (S3Exception e) {
            throw new StorageException("Failed to upload part %d for %s".formatted(partNumber, objectKey), e);
        }
    }

    @Override
    public void completeMultipartUpload(String objectKey, String uploadId, List<PartResult> parts) {
        List<CompletedPart> completedParts = parts.stream()
                .sorted(Comparator.comparingInt(PartResult::partNumber))
                .map(p -> CompletedPart.builder().partNumber(p.partNumber()).eTag(p.eTag()).build())
                .toList();

        try {
            s3Client.completeMultipartUpload(CompleteMultipartUploadRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .uploadId(uploadId)
                    .multipartUpload(CompletedMultipartUpload.builder().parts(completedParts).build())
                    .build());
        } catch (S3Exception e) {
            throw new StorageException("Failed to complete multipart upload for " + objectKey, e);
        }
    }

    @Override
    public void abortMultipartUpload(String objectKey, String uploadId) {
        try {
            s3Client.abortMultipartUpload(AbortMultipartUploadRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .uploadId(uploadId)
                    .build());
        } catch (S3Exception e) {
            throw new StorageException("Failed to abort multipart upload for " + objectKey, e);
        }
    }
}
