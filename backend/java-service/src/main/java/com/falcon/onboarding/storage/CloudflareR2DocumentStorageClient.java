package com.falcon.onboarding.storage;

import com.falcon.onboarding.exception.DocumentStorageException;
import com.falcon.upload.config.R2Properties;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.net.URI;

/**
 * Same dedicated test bucket as {@code upload.storage.CloudflareR2StorageClient},
 * built the same way, but a separate class implementing a separate,
 * single-shot-object interface: {@link ObjectStorageClient} in the upload
 * package is a multipart-upload contract, and onboarding's document images
 * are small single-object puts/gets, so the two stay independently
 * swappable/fakeable rather than sharing one interface.
 */
@Component
public class CloudflareR2DocumentStorageClient implements DocumentStorageClient {

    private final S3Client s3Client;
    private final String bucket;

    public CloudflareR2DocumentStorageClient(R2Properties properties) {
        this.bucket = properties.bucket();
        this.s3Client = S3Client.builder()
                .endpointOverride(URI.create(properties.endpoint()))
                .region(Region.of("auto"))
                .forcePathStyle(true)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(properties.accessKey(), properties.secretKey())))
                .build();
    }

    @Override
    public void putObject(String objectKey, byte[] content, String contentType) {
        try {
            s3Client.putObject(PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(objectKey)
                            .contentType(contentType)
                            .build(),
                    RequestBody.fromBytes(content));
        } catch (S3Exception e) {
            throw new DocumentStorageException("Failed to store document " + objectKey, e);
        }
    }

    @Override
    public byte[] getObject(String objectKey) {
        try {
            return s3Client.getObject(GetObjectRequest.builder()
                            .bucket(bucket)
                            .key(objectKey)
                            .build())
                    .readAllBytes();
        } catch (S3Exception e) {
            throw new DocumentStorageException("Failed to retrieve document " + objectKey, e);
        } catch (java.io.IOException e) {
            throw new DocumentStorageException("Failed to read document " + objectKey, e);
        }
    }
}
