package com.falcon.upload.service;

import com.falcon.upload.config.UploadProperties;
import com.falcon.upload.domain.PartResult;
import com.falcon.upload.domain.UploadSession;
import com.falcon.upload.repository.UploadSessionRepository;
import com.falcon.upload.storage.ObjectStorageClient;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Producer-consumer pipeline that decouples "a part arrived over HTTP" from
 * "a part got uploaded to R2".
 *
 * <p>Producers: HTTP request threads calling {@link #submit}, one per
 * incoming part.
 *
 * <p>Consumers: a fixed number of dedicated virtual threads (sized by
 * {@code upload.worker-pool-size}) that loop on {@link BlockingQueue#take()}.
 * Bounding the worker count bounds how many concurrent uploadPart calls hit
 * R2 at once, independent of how many HTTP requests arrive simultaneously -
 * the queue absorbs the burst. A platform-thread {@code newFixedThreadPool}
 * would work the same way structurally; virtual threads are used here
 * because uploadPart is I/O-bound and blocks on network calls, which is
 * exactly the case virtual threads are designed to make cheap.
 *
 * <p>When a worker observes the last expected part for a session (via
 * {@link UploadSession#recordPartAndCheckReadyToComplete}), it fires the
 * CompleteMultipartUpload call asynchronously via {@link CompletableFuture}
 * on a separate executor, so it never blocks the worker that could be
 * picking up the next queued part.
 */
@Component
public class PartUploadPipeline {

    private static final Logger log = LoggerFactory.getLogger(PartUploadPipeline.class);

    private final BlockingQueue<PartUploadTask> queue = new LinkedBlockingQueue<>();
    private final ObjectStorageClient storageClient;
    private final UploadSessionRepository repository;
    private final UploadProperties properties;
    private final ExecutorService completionExecutor = Executors.newVirtualThreadPerTaskExecutor();

    private Thread[] workers;
    private volatile boolean running = true;

    public PartUploadPipeline(ObjectStorageClient storageClient, UploadSessionRepository repository, UploadProperties properties) {
        this.storageClient = storageClient;
        this.repository = repository;
        this.properties = properties;
    }

    @PostConstruct
    void startWorkers() {
        int poolSize = Math.max(1, properties.workerPoolSize());
        workers = new Thread[poolSize];
        for (int i = 0; i < poolSize; i++) {
            workers[i] = Thread.ofVirtual().name("part-upload-worker-" + i).start(this::workerLoop);
        }
        log.info("Started {} part-upload worker threads", poolSize);
    }

    @PreDestroy
    void stopWorkers() {
        running = false;
        for (Thread worker : workers) {
            worker.interrupt();
        }
        completionExecutor.shutdown();
    }

    /** Producer side: enqueue a part and hand back a future the caller can await. */
    public CompletableFuture<PartResult> submit(String sessionId, String objectKey, String r2UploadId, int partNumber, byte[] data) {
        CompletableFuture<PartResult> future = new CompletableFuture<>();
        queue.add(new PartUploadTask(sessionId, objectKey, r2UploadId, partNumber, data, future));
        return future;
    }

    private void workerLoop() {
        while (running) {
            try {
                PartUploadTask task = queue.take();
                process(task);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    private void process(PartUploadTask task) {
        try {
            PartResult result = storageClient.uploadPart(
                    task.objectKey(), task.r2UploadId(), task.partNumber(), new ByteArrayInputStream(task.data()), task.data().length);

            log.debug("[{}] part {} uploaded on {}", task.sessionId(), task.partNumber(), Thread.currentThread().getName());
            task.future().complete(result);

            repository.findById(task.sessionId()).ifPresent(session -> {
                boolean readyToComplete = session.recordPartAndCheckReadyToComplete(result);
                if (readyToComplete) {
                    triggerCompletion(session);
                }
            });
        } catch (Exception e) {
            task.future().completeExceptionally(e);
            repository.findById(task.sessionId()).ifPresent(session -> session.markFailed(e));
        }
    }

    private void triggerCompletion(UploadSession session) {
        CompletableFuture.runAsync(() -> {
            try {
                storageClient.completeMultipartUpload(session.objectKey(), session.r2UploadId(), List.copyOf(session.parts()));
                session.markCompleted();
                log.info("[{}] multipart upload completed ({} parts)", session.id(), session.totalParts());
            } catch (Exception e) {
                log.error("[{}] failed to complete multipart upload", session.id(), e);
                session.markFailed(e);
            }
        }, completionExecutor);
    }
}
