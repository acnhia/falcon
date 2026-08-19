package com.falcon.upload.service;

import com.falcon.upload.domain.PartResult;
import java.util.concurrent.CompletableFuture;

/** One unit of producer-consumer work: a part waiting to be uploaded to R2. */
record PartUploadTask(
        String sessionId,
        String objectKey,
        String r2UploadId,
        int partNumber,
        byte[] data,
        CompletableFuture<PartResult> future) {
}
