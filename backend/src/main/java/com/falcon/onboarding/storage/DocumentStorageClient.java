package com.falcon.onboarding.storage;

/**
 * Provider-neutral single-object storage port. Deliberately has no
 * presigned/public-URL method - that capability must not exist at all, so
 * document objects can never be served through a public bucket URL.
 */
public interface DocumentStorageClient {
    void putObject(String objectKey, byte[] content, String contentType);

    byte[] getObject(String objectKey);
}
