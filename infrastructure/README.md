# Infrastructure deployment

The Java backend remains the cloud-agnostic reference implementation. This folder holds provider-specific deployment adapters.

## Cloudflare

The Cloudflare project exposes the same upload API through a Worker. A Durable Object owns each upload session, serializes its lifecycle, and uses R2 multipart uploads directly. File bytes stream from the browser request to R2 instead of being buffered in an application server.

The deployment also enforces a **10 GiB application storage ceiling**. Before an upload starts, the frontend supplies its file size and the Worker atomically reserves that amount through a single quota Durable Object. A request that would exceed the ceiling is rejected before any part reaches R2; aborted sessions release their reservation. The browser then offers an explicit confirmation to delete and retry. That deletion removes only application-owned objects beneath `uploads/`; it never deletes unrelated bucket content. This quota accounts for objects created through this application. If the bucket contains pre-existing or externally-created objects, include those in the quota baseline before relying on the limit.

### Launching a deployment

`infra/cloudflare/scripts/launch.mjs` is the single entry point that deploys every essential artifact in order:

1. Install and type-check the Worker, then run its test suite.
2. Install, type-check, test, and build the React frontend (`react/dist`).
3. Provision the R2 bucket idempotently (`scripts/provision-r2.mjs` creates it if missing, reuses it otherwise).
4. Provision the D1 database and apply the idempotent transfer schema (`scripts/provision-d1.mjs`).
5. Run `wrangler deploy`, which publishes both the static React assets and the Worker.

Both `account_id` and `api_token` must already be set in the root `.env` file; `BUCKET_NAME` and `D1_DATABASE_NAME` are read from `.env` if present and otherwise default to `upload-demo-test` / `upload-transfer-test`. Set `SKIP_TESTS=true` to skip the test gates (type checks always run).

**Recommended: run it in a container**, so nothing needs to be installed locally beyond Docker itself:

```bash
cd infra/cloudflare
npm run launch:docker
```

This builds a throwaway Node image (`Dockerfile.deploy`), bind-mounts the repository into it, and runs `launch.mjs` inside the container. Each project's `node_modules` lives in a named Docker volume so container-installed (Linux) dependencies never overwrite your host `node_modules`. The repo itself is bind-mounted read-write, so provisioning updates (`.env`, `wrangler.jsonc`) and the React build output land back on the host as usual.

To run the same pipeline without Docker:

```bash
cd infra/cloudflare
npm install
npm run launch
```

The frontend can continue using its relative `/api` address when it is served behind the Worker route or custom domain.

## AWS

A future AWS adapter should preserve this HTTP contract and map it to API Gateway, Lambda, S3 multipart uploads, and a durable per-session store. Provider resource names, credentials, and policies belong here—not in `backend/`.
