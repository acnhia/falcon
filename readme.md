# Multipart Upload to Cloudflare R2 — Learning Demo

A small full-stack project built to *learn from*, not to run in production. A React UI splits a
file into parts and uploads them concurrently to a Java (Spring Boot 3 / Java 21) backend, which
forwards each part to Cloudflare R2 (S3-compatible object storage) via a hand-built
producer-consumer pipeline. Runs as three Docker containers behind an nginx reverse proxy.

Credentials live only in `.env` (gitignored) — never commit real values or paste them into this
file.

## Architecture

```
Browser                    nginx :8080              backend :8081            Cloudflare R2
┌──────────────┐   /       ┌──────────┐   /api/*   ┌────────────────┐  S3 API  ┌───────────┐
│ React (Vite) │◄─────────►│  reverse │◄──────────►│ Spring Boot    │◄────────►│  bucket   │
│ chunkFile()  │  parts    │  proxy   │  PUT parts │ UploadOrchestr.│  parts   │           │
│ uploadManager│  (N conc.)│          │  (N conc.) │ PartUploadPipe.│          │           │
└──────────────┘           └──────────┘             └────────────────┘          └───────────┘
```

- React slices the file client-side into parts (5–8MB each) and uploads up to 4 at a time.
- Each `PUT /api/uploads/{sessionId}/parts/{n}` request lands on the backend, which enqueues it
  and forwards it to R2 via a pool of worker threads.
- When the last expected part is recorded, the backend automatically completes the R2 multipart
  upload; the frontend also calls `POST /complete` explicitly once all parts succeed (idempotent
  either way).

## Running it

```bash
docker compose up --build
```

Then open **http://localhost:8080**.

Requires a `.env` file in this directory (see `.env` for the expected keys: `account_id`,
`api_token`, `access_id`, `secret_key`, `s3_url`). `docker-compose.yml` maps these into the
backend's Spring environment variables (`ACCOUNT_ID`, `ACCESS_ID`, `SECRET_KEY`, `S3_URL`,
`BUCKET_NAME`).

**Before it will actually upload to R2, you need to, in the Cloudflare dashboard:**
1. Enable R2 for the account (if not already) and create a bucket (default expected name:
   `upload-demo`, or set `BUCKET_NAME` in `.env` to match an existing bucket).
2. Make sure the API token in `.env` has R2 **read+write** permissions — the token currently in
   `.env` verifies as valid but returns an authentication error on R2-specific calls, so it likely
   needs its permissions widened (or a new R2 API token created) before uploads will succeed.

## REST API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/uploads` | `{filename, totalParts}` → `{sessionId, objectKey, totalParts}` |
| PUT | `/api/uploads/{sessionId}/parts/{n}` | binary body → `{partNumber, eTag}` |
| POST | `/api/uploads/{sessionId}/complete` | idempotent; finalizes the R2 multipart upload |
| POST | `/api/uploads/{sessionId}/abort` | aborts the session and the R2 multipart upload |
| GET | `/api/uploads/{sessionId}` | `{status, completedParts, totalParts}` |

## OOP design

| Pattern | Class(es) | Why |
|---|---|---|
| **State** | `UploadState` + `InitiatedState`/`UploadingState`/`CompletingState`/`CompletedState`/`FailedState`/`AbortedState` (`domain/`) | The upload lifecycle is a real state machine, not a status field flipped by ad-hoc `if`s. Each state class decides which transitions are legal from itself; illegal ones throw `IllegalStateTransitionException` instead of silently corrupting a session. |
| **Repository** | `UploadSessionRepository` (interface) + `InMemoryUploadSessionRepository` | Isolates session persistence from orchestration logic. A Redis-backed implementation (needed to scale the backend to multiple replicas) would only require a new class implementing this interface — nothing else in the app would change. |
| **Adapter / Strategy** | `ObjectStorageClient` (interface) + `CloudflareR2StorageClient` | Every AWS-SDK-specific detail (endpoint override, path-style addressing, request/response types) is isolated behind one seam. The rest of the app never imports an AWS SDK class directly. |
| **Facade** | `UploadOrchestrator` / `DefaultUploadOrchestrator` | The REST controller has one simple dependency; it doesn't know a part upload involves a queue, worker threads, and a state machine underneath. |
| **Producer-Consumer** | `PartUploadPipeline` + `PartUploadTask` | See Concurrency below — this is where most of the interesting mechanics live. |

## Concurrency

`PartUploadPipeline` (`backend/src/main/java/com/demo/upload/service/PartUploadPipeline.java`) is
the core of the demo:

- **Producers**: every HTTP request thread handling a `PUT .../parts/{n}` call wraps the part as a
  `PartUploadTask` and drops it on a `BlockingQueue`, then blocks on that task's own
  `CompletableFuture` (with a timeout) to give the client a definitive success/failure per part.
- **Consumers**: a fixed number of dedicated **virtual threads** (`upload.worker-pool-size`, default
  8) loop on `queue.take()` and call R2's `UploadPart` API. Virtual threads are used because
  `uploadPart` is I/O-bound and blocks on the network — exactly the case Java 21 virtual threads
  are designed to make cheap. Bounding the worker count bounds concurrent R2 calls independent of
  how many HTTP requests arrive at once; the queue absorbs the burst.
- **Shared state without a coarse lock**: `UploadSession.parts` is a `ConcurrentHashMap` (safe
  concurrent inserts, no locking needed since each part number is written exactly once).
  `completedCount` is an `AtomicInteger`. `completionStarted` is an `AtomicBoolean` — its
  `compareAndSet` is what guarantees that exactly one thread ever triggers
  `CompleteMultipartUpload`, even if the pipeline's auto-trigger and an explicit
  `POST /complete` call race for it at the same instant.
- **Async completion**: the winning thread doesn't block itself finishing the upload — it fires
  `CompleteMultipartUpload` via `CompletableFuture.runAsync` on a separate executor, so it's
  immediately free to pick up the next queued part.
- **State transitions**, unlike part completions, are rare and must be strictly ordered, so they
  go through a single `synchronized` method on `UploadSession` rather than lock-free primitives.

On the frontend, `uploadManager.js` implements the same *shape* of concurrency in the browser: a
fixed number of "worker" async functions share one `nextIndex` cursor and race to claim the next
part, capping how many `XMLHttpRequest`s are in flight at once (default 4) — a hand-rolled version
of the same bounded-worker-pool idea used in Java, without an extra dependency.

## Project structure

```
backend/   Spring Boot 3 / Java 21 — see src/main/java/com/demo/upload/{domain,repository,storage,service,web,config}
react/     Vite + React — see src/upload/{api.js,chunkFile.js,uploadManager.js,UploadPage.jsx}
nginx/     reverse proxy config, routes / to frontend and /api/ to backend
docker-compose.yml   3 services: backend, frontend, nginx
```

## Log

- **2026-08-09** — Initial build. Backend and frontend compile and run cleanly via
  `docker compose up --build`; all three containers (backend, frontend, nginx) start and pass a
  basic connectivity check. Actual end-to-end upload to R2 is currently blocked by an R2-side
  account setup issue (see "Running it" above) — the R2 S3 endpoint's TLS handshake fails for this
  account, and the API token returns an authentication error on R2-specific calls, so R2 appears to
  need to be enabled and/or the token needs broader permissions before a real upload can be
  verified end-to-end.
