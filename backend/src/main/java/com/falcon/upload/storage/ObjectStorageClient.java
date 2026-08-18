package com.falcon.upload.storage;

import com.falcon.upload.domain.PartResult;
import java.io.InputStream;
import java.util.List;

/**
 * Adapter/Strategy seam: everything vendor-specific (AWS SDK types, R2
 * endpoint quirks) stays behind this interface. The rest of the app only
 * ever depends on this port, so the storage backend could be swapped
 * (different provider, or a fake for tests) without touching the
 * orchestrator or pipeline.
 */
public interface ObjectStorageClient {

    String createMultipartUpload(String objectKey);

    PartResult uploadPart(String objectKey, String uploadId, int partNumber, InputStream body, long contentLength);

    void completeMultipartUpload(String objectKey, String uploadId, List<PartResult> parts);

    void abortMultipartUpload(String objectKey, String uploadId);
}
