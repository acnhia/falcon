# Brokerage onboarding partner POC — deployment requirements

## Purpose

Define a safe, repeatable path to run and deploy the brokerage-onboarding POC without mixing demo data, secrets, or provider integrations into production-like environments.

## Environments

| Environment | Purpose | Data and providers |
| --- | --- | --- |
| Local | Developer workflow and automated tests. | Synthetic fixtures; mock validation, assistant, and market adapters only. |
| Demo | Partner-facing POC. | Synthetic data; delayed/approved market feed only; mock validation by default. |
| Production | Future, separately approved deployment. | Out of scope until legal, privacy, security, data-license, and compliance review completes. |

## Deployment architecture

```text
React static client
    -> API gateway / edge route
    -> onboarding-api-worker (synchronous task boundary)
    -> Java Spring Boot onboarding service
       -> private document storage adapter
       -> onboarding database
       -> market-data adapter
       -> assistant/voice adapter
```

- The React client is static and contains no secrets.
- The Java service is packaged as a container image for portability.
- `onboarding-api-worker` is a logical synchronous entry point, not a provider requirement. It may be a Java function, Java container endpoint, or thin edge gateway forwarding to Java.
- Cloudflare Workers may host static assets or edge routing, but do not run the Java JAR. A Worker calls a separately deployed Java service over HTTPS when that topology is selected.
- AWS Lambda and Azure Functions can run Java handlers, but the initial POC container is the reference implementation for long-running service portability.

## Workflow persistence and recovery

- Local and demo environments require a relational onboarding database that persists application, activity checkpoint, normalized field, idempotency-operation, provider-check, acknowledgement, and redacted audit records.
- The infrastructure module must provision or reuse this database non-destructively and run versioned migrations. A restart, redeploy, or browser refresh must not lose a partially completed synthetic application.
- Database backups, encryption/key management, retention/deletion, and access roles are future production controls; the POC documents their need but does not claim to implement production compliance.
- A later asynchronous worker deployment must persist job status in the same workflow model and expose a safe polling/status API; it must not rely on an in-memory queue for resumability.

## User stories

### DEP-001 — Run locally with no external credentials

**As a developer,** I can start the full POC locally using synthetic fixtures so that I can develop and test without live cloud or AI access.

**Acceptance criteria**

- A documented command starts frontend, backend, local persistence, and mock adapters.
- A sample environment file contains keys and safe example values only; it contains no live secrets.
- The local workflow can execute the onboarding, capture, and mock-validation journey using synthetic test files.

### DEP-002 — Build reproducible artifacts

**As a delivery engineer,** I can create immutable frontend and backend build artifacts so that deployments are repeatable.

**Acceptance criteria**

- The frontend build is versioned and produces static assets.
- The backend build produces a Java 21 executable JAR and a minimal runtime container image.
- Builds use pinned dependency versions and fail on test or type-check failure.
- Container images run as non-root where the base image supports it.

### DEP-003 — Provision isolated demo resources

**As a delivery engineer,** I can provision or reuse dedicated demo resources without touching unrelated resources.

**Acceptance criteria**

- Infrastructure code creates or reuses a POC-specific database, private document-storage bucket/prefix, service identity, and configuration bindings.
- Resource names include an environment boundary such as `brokerage-onboarding-demo`.
- Provisioning is idempotent and never deletes existing objects, tables, or buckets by default.
- Test-data cleanup is explicit, prefix-scoped, logged, and requires a confirmation in interactive workflows.

### DEP-004 — Configure secrets safely

**As a platform operator,** I can configure provider credentials without exposing them to source control or the browser.

**Acceptance criteria**

- OpenAI, market-data, storage, email/SMS, and database credentials are injected through environment variables or a managed secret store.
- The React build receives only non-sensitive public configuration, such as an API base URL.
- Startup validates required secrets only for adapters that are enabled.
- Logs, error reports, deployment output, and health endpoints redact secret values and capture tokens.

### DEP-005 — Keep live providers disabled by default

**As a platform operator,** I can enable a provider only after the required commercial and compliance approvals exist.

**Acceptance criteria**

- `mock` is the default mode for document validation and conversational assistance.
- Market-data mode defaults to `fixture`; delayed/real-time modes require an explicit environment setting and provider key.
- Russia/MOEX remains disabled unless an explicit configuration flag and approved entitlement are present.
- A ChatGPT subscription is never treated as API credentials or an API budget; live OpenAI mode requires a separately billed API account and configured spend limit.

### DEP-006 — Deploy and expose a controlled demo URL

**As a partner-demo operator,** I can deploy the POC behind a controlled hostname with TLS.

**Acceptance criteria**

- Demo uses a custom hostname such as `onboarding-demo.example.com` or an approved provider-generated URL.
- TLS is enforced and HTTP redirects to HTTPS.
- Capture links are built from the externally visible public base URL and are not accepted from a browser-supplied host header.
- Cross-origin access is restricted to approved frontend origins.

### DEP-007 — Promote only verified builds

**As a release manager,** I can deploy only artifacts that passed automated quality gates.

**Acceptance criteria**

- CI runs frontend tests, backend tests, type checks, linting, dependency/security scanning, and container build checks.
- A browser end-to-end test covers the synthetic front/back capture and mock validated result.
- Deployment creates a release record including source revision, artifact version, environment, and enabled adapter modes.
- Rollback returns to the last verified artifact without running destructive data changes.

### DEP-008 — Deploy a bounded synchronous worker API

**As a platform operator,** I can expose approved onboarding activities through an API-gateway-to-worker boundary without opening arbitrary task execution.

**Acceptance criteria**

- Gateway routes map to approved task activities; the external API does not accept class/module paths.
- Each deployed worker has request timeout, size, rate, and concurrency limits appropriate to its platform.
- Correlation IDs flow from gateway through task wrapper, service, and response.
- Work that exceeds synchronous limits has a separately configured asynchronous design before deployment.

## Configuration contract

| Variable | Required when | Safety requirement |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | Demo deployment | Trusted server configuration; do not infer from inbound headers. |
| `DOCUMENT_STORAGE_MODE` | Always | Defaults to `mock` or isolated private storage. |
| `VALIDATION_MODE` | Always | Defaults to `mock`. |
| `MARKET_DATA_MODE` | Always | Defaults to `fixture`; real-time requires approved entitlement. |
| `TWELVE_DATA_API_KEY` | Twelve Data enabled | Server-only secret. |
| `AI_MODE` | Always | Defaults to `mock`. |
| `OPENAI_API_KEY` | Live OpenAI enabled | Server-only secret, separately billed API account. |
| `CAPTURE_LINK_TTL` | Always | Short bounded duration, configurable by environment. |
| `EMAIL_DELIVERY_MODE` | Link delivery enabled | Defaults to `copy-link` locally; provider secret is server-only. |

## Platform-specific guidance

### Cloudflare

- Host static React assets on Workers/Pages or behind a Worker custom domain.
- **The onboarding API (activities 1-4, identity capture) runs directly on the Worker**, backed by
  its own D1 database (`ONBOARDING_DB` binding, isolated `infra/cloudflare/src/onboarding/` module,
  separate migration set from the file-transfer demo's `TRANSFERS` binding) and the same R2 bucket
  used for file transfers, under a distinct `onboarding/` key prefix. This is a second, parallel
  implementation of the same API contract as the Java backend — not the Java backend itself, since
  Workers cannot run a JVM. The Java backend remains the reference implementation for local/container
  development and its own test suite.
- One known, deliberate gap versus the Java reference implementation: document validation on the
  Worker checks file size, MIME allowlist, and a magic-byte/header-based width/height read for
  JPEG/PNG (WebP is signature-checked only, no dimension read) rather than a full image decode —
  Workers has no `ImageIO`-equivalent decoder. See `infra/cloudflare/src/onboarding/documentValidation.ts`.
- For a future adapter that instead calls a separately-hosted Java service (e.g. if activities 5-21
  are built there before being ported to Workers): use a Worker only for edge/static/API routing,
  and bind R2/D1 only when the selected adapter uses them, retaining private-object access through
  server-side bindings.

### AWS

- Run the Java service on ECS/Fargate, App Runner, or Java Lambda based on runtime duration and traffic profile.
- Use S3, RDS/DynamoDB, Secrets Manager, and API Gateway/custom domain as adapters rather than domain dependencies.

### Azure

- Run the Java service on Container Apps, App Service, or Java Azure Functions based on runtime duration and traffic profile.
- Use Blob Storage, Azure SQL/Cosmos DB, Key Vault, and Front Door/custom domain through adapter implementations.

## Deployment testing and controls

- Infrastructure tests verify idempotent provisioning, least-privilege bindings, and private storage configuration.
- Smoke tests verify HTTPS, health/readiness endpoints, CORS, synthetic onboarding creation, capture-token expiry, and disabled-provider messages.
- No CI environment stores real driver-license images. Fixtures must be synthetic and clearly labelled.
- Do not deploy a live market feed, real validation provider, or live AI provider merely because credentials exist; each requires an explicit environment enablement decision.
- Environment configuration must keep every address, tax, funding, screening, and final-decision adapter in its documented mock/approved mode. The four-section activity/status boundaries are defined in [wizard component user stories](06-wizard-component-user-stories.md).
