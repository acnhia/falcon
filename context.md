# Brokerage onboarding partner POC — working context

Last updated: 2026-08-17

## Purpose

Build a partner-facing proof of concept that demonstrates a modern brokerage-account onboarding experience and the organisation's engineering capability. The POC combines a React frontend, Java/Spring Boot backend, provider-neutral integrations, automated tests, containerized local execution, and cloud-portable deployment.

This is a **demonstration only**, not a production brokerage service.

## Current status

- The existing repository contains a separate multipart file-transfer demo under `backend/`, `react/`, and `infra/`.
- The account-onboarding **identity-capture slice** (start application → capture-link token → front/back document capture → mock validation → `READY_FOR_REVIEW`) is implemented end-to-end and tested, now running on the JDBC/H2 persistence layer described below instead of in-memory maps.
- The **wizard/workflow "foundation" phase** (activities 1–4 of 21, wizard screens 1–2 of 8; see [wizard, normalized data, and service design](docs/brokerage-onboarding/05-wizard-data-and-services.md)) is implemented and tested:
  - Backend: `com.falcon.onboarding` — added `spring-boot-starter-jdbc` + H2 (file-based locally, in-memory for tests), an idempotent `schema.sql` covering 9 of the doc's 12 tables (`onboarding_application`, `onboarding_activity`, `field_definition`, `application_field_value`, `identity_capture_session`, `identity_document`, `provider_check`, `workflow_operation`, `application_audit_event`), a `repository.jdbc` package replacing the old in-memory `@Repository` beans, a `workflow` package (`ActivityProgressService` for resume-pointer/completion-percentage, `AgeIdentityPrecheckService` as the activity-4 mock check), and a new `WizardOrchestrator`/`DefaultWizardOrchestrator` service (kept separate from `OnboardingOrchestrator` so the existing capture-flow contract and tests stay untouched) exposing `GetResumeState`, `SaveActivityDraft`, `ContinueActivity` through the same allowlisted `TaskRegistry` pattern. All 21 activity rows are created eagerly per application so resume/completion math is truthful from day one, even though only activities 1–4 have real logic. 25 test classes / 74 tests passing (`mvn test` via `docker run maven:3.9-eclipse-temurin-21`).
  - Frontend: `react/src/onboarding/WelcomePage.tsx` (screen 1: consent checkboxes, create-or-resume via a `localStorage`-held public reference), `PersonalInformationPage.tsx` (screen 2: dark two-panel layout, form driven by the seeded field catalogue, save-draft/continue, completion bar, and a **client-side-only deterministic mock chat + mock voice toggle** — no backend call, no real AI/STT), `OnboardingWizard.tsx` (container deciding screen 1 vs. 2 vs. "not built yet" from server-reported `wizardScreen`), `mockAssistant.ts` (pure canned-suggestion logic). `react/src/App.jsx`'s bare `/` route now serves the wizard; the file-transfer demo moved to `#/upload`. 12 test files / 50 tests passing (`npm test`), `tsc --noEmit`, `npm run build`, and `oxlint` all clean.
  - Deferred to later phases: wizard screens 3–8, `application_address`/`application_disclosure_acknowledgement`/`application_agreement_acceptance` tables, the general stale-dependency graph (only the activity-3→4 date-of-birth edge exists), the market ticker, and the full `assistant`/`marketdata`/`verification`/`disclosures`/`notifications`/`decisioning` modules.
  - Known gap, called out deliberately rather than silently: `application_field_value.value` is stored as plain text in this POC (only ever synthetic data by design); real production use would need encryption/key management for that column.
  - Not yet done: a full `docker compose up --build` manual smoke test of the end-to-end journey (automated test suites cover it; the manual run wasn't executed to avoid touching the live Cloudflare credentials in the root `.env`).
- The planned application must be built separately from the file-transfer demo’s production code paths.
- Detailed source requirements live in:
  - [Overview](docs/brokerage-onboarding/00-overview.md)
  - [Frontend](docs/brokerage-onboarding/01-frontend.md)
  - [Backend](docs/brokerage-onboarding/02-backend.md)
  - [Deployment](docs/brokerage-onboarding/03-deployment.md)
  - [Detailed 21-step onboarding flow](docs/brokerage-onboarding/04-onboarding-flow.md)
  - [Wizard, normalized data, and service design](docs/brokerage-onboarding/05-wizard-data-and-services.md)
  - [Global project requirements](REQUIREMENTS.md)

## Working agreements

- Record every user requirement in Markdown before implementation.
- Use test-driven development: start with a failing automated test, then make the smallest implementation that passes.
- Maintain focused frontend, backend, and infrastructure tests.
- Keep business logic cloud-neutral; place cloud-provider implementations in adapters and infrastructure configuration.
- Never place credentials, PII, driver-license images, capture tokens, or secrets in source control, browser code, logs, screenshots, or this file.

## Durable design guidelines

### Project and naming structure

- Keep the brokerage-onboarding POC separate from the existing file-transfer demo.
- Use responsibility-based, cloud-neutral names. For example: `storage`, `validation`, `marketdata`, `assistant`, `delivery`, and `workers` describe what a component does rather than naming a cloud product or provider.
- Put provider-specific code behind adapters. Avoid names such as `Lambda` in business/domain code; deployment-specific names belong only in infrastructure modules.
- Keep deployment resources in a sibling `infrastructure` area, separate from frontend and Java backend application code.
- Java business logic uses the `com.falcon` namespace when added to this repository, and package/directory/import alignment is mandatory.

### Layering and boundaries

- Controllers are thin HTTP adapters: route mapping, input validation, authentication/authorization boundary, and response mapping.
- Application services orchestrate use cases and transactions.
- Domain models express workflow state, business invariants, and cloud-neutral ports/interfaces.
- External services—storage, market data, AI, email/SMS, document verification, and databases—are infrastructure adapters that implement those ports.
- API request/response DTOs must be distinct from database entities and domain models.
- Configuration is typed and loaded from `application.yaml` plus environment/secret injection; it is not scattered across application code.

### Security and privacy by design

- Assume browser code is untrusted. It receives no long-lived provider or cloud credentials.
- Use opaque, unguessable public identifiers and capture tokens. Never expose database IDs, object keys, customer identifiers, or secrets in URLs.
- Store sensitive objects privately; use server-controlled access or narrowly scoped URLs, never public bucket URLs.
- Treat document content, applicant data, voice transcripts, and market-provider credentials as sensitive. Redact them from logs and telemetry.
- Use synthetic data by default in local, test, and partner-demo environments.
- Make destructive cleanup explicit, scoped, auditable, and confirmation-gated.

### UX and product quality

- Clearly label mock, fixture, delayed, disabled, and real-time states. Never let a demo presentation imply an unimplemented or unlicensed capability.
- Explain material permission requests just before they occur, especially camera access.
- Make screens mobile-friendly, accessible by keyboard, and usable with clear error and recovery states.
- Show data provenance, timestamps, and limitations for externally sourced content.

### Testing and delivery

- Start new behavior with a focused failing test.
- Cover normal paths, validation failures, state transitions, retries/idempotency, concurrency boundaries where applicable, and provider-contract behavior.
- Build and test frontend, backend, and infrastructure independently, then verify the critical end-to-end synthetic journey.
- Prefer reproducible container builds, pinned dependencies, least-privilege configuration, and deployment promotion only after quality gates pass.

## Context maintenance protocol

- `context.md` is the durable reconstruction artifact for this POC. It is a curated record of agreed context, not a repository for credentials or raw sensitive transcripts.
- When the user says to retain/export a discussion or decision, append a concise entry to the decision log with: date, decision, rationale, scope, and any unresolved follow-up.
- Update the relevant detailed requirements document as well when the retained discussion changes a product, frontend, backend, or deployment requirement.
- Do not silently overwrite prior decisions. Mark superseded decisions explicitly and link to their replacement.
- Record implementation status after material milestones, including test outcomes and known blockers.

## Decision log

| Date | Decision | Rationale and scope | Status |
| --- | --- | --- | --- |
| 2026-08-12 | Keep cloud deployment concepts provider-neutral. | Java business logic stays portable; Cloudflare/AWS/Azure specifics belong in adapters and infrastructure. | Active |
| 2026-08-12 | Use TDD across backend, frontend, and infrastructure. | Tests precede new behavior and demonstrate partner-facing engineering discipline. | Active |
| 2026-08-12 | Apply a 10 GiB test-storage ceiling to the file-transfer demo. | Avoid unbounded test-storage cost; deletion is explicit and prefix-scoped. | Active for file-transfer demo |
| 2026-08-12 | Use `com.filemanagement` as the Java root namespace. | Align Java package naming with broader file-management capabilities. | **Superseded** by the 2026-08-17 `com.falcon` rename row below |
| 2026-08-17 | Build a separate brokerage-onboarding partner POC. | Avoid mixing the new account-onboarding domain into the existing file-transfer application. | **Superseded** by the 2026-08-17 package-level-isolation row below |
| 2026-08-17 | Driver-license workflow is mock/synthetic only. | Prevent real PII, document, biometric, and regulated identity-processing risk during the POC. | Active |
| 2026-08-17 | Use a provider-neutral market-data adapter; evaluate Twelve Data first. | Support requested global markets while preserving future provider portability and licensing controls. | Planned; fixture mode first |
| 2026-08-17 | Use mock AI/voice first; do not use ChatGPT subscription as API funding. | ChatGPT and API billing are separate; live API use requires a separately billed server-side integration. | Active |
| 2026-08-17 | Define the synthetic onboarding journey as a detailed 21-step flow. | Make user/system actions, state transitions, data boundaries, recovery behavior, and test expectations clear before implementation. | Active |
| 2026-08-17 | Use an Otterobot-inspired synchronous task-worker pattern. | High-level tasks wrap one action with shared validation/timing/error behavior; a gateway exposes only allowlisted bounded activities. | Active — implemented as `com.filemanagement.onboarding.task` (`BaseTask`/`TaskRegistry`/`TaskResult`) |
| 2026-08-17 | Implement the account-onboarding workflow as `com.falcon.onboarding` inside the existing `backend/` app and `react/src/onboarding/` inside the existing React app, not a separate deployable. | Isolation enforced at package/route/prefix level (mirrors how `upload/`/`download/` already separate concerns in this repo); avoids doubling scaffolding (new pom.xml/Vite config/Dockerfile/compose service) for a POC slice. Explicitly chosen over the "dedicated implementation folder" framing above after the user was asked directly. | Active; supersedes the earlier "separate POC" row |
| 2026-08-17 | Write the onboarding React code in TypeScript, while the existing upload/download React code stays plain JS/JSX. | User asked mid-implementation to use TypeScript for the React side. No tsconfig/`typescript` package existed in `react/` yet; added both, scoped to allow mixed `.jsx`/`.tsx` in the same Vite app rather than converting existing files. | Active |
| 2026-08-17 | Make the next onboarding POC slice a dark personal-information workspace: left-side synthetic form, persistent right-side chat, and an explicit voice-input control at the bottom. | Text and mock voice can propose, but never silently apply or submit, editable form values. The view labels itself stage 2 of 21; later stages remain status-only until separately implemented. | Active — implemented as `react/src/onboarding/PersonalInformationPage.tsx` (chat/voice are client-side deterministic mocks, no backend call) |
| 2026-08-17 | Use an original dark-fintech visual language with restrained green positive-state accents. | It may take broad inspiration from consumer-finance conventions, but must not copy Robinhood or another company’s branding, assets, layouts, components, or distinctive trade dress. | Active |
| 2026-08-17 | Make the personal-information workspace the POC landing page. | The root route `/` opens stage 2 of 21 with the synthetic form, chat, and voice control; `/onboarding` may redirect for compatibility. | Active |
| 2026-08-17 | Implement 21 workflow activities through 8 user-facing wizard screens, with background/derived checks rendered as visible statuses rather than extra screens. | Keeps the journey focused while preserving resumable, auditable workflow detail. Begin as modular services behind one worker; only split deployables when justified. | Active — activities 1-4 / screens 1-2 implemented as the "foundation" phase; activities 5-21 / screens 3-8 remain schema-only (all 21 `onboarding_activity` rows exist, but only 1-4 have real logic) |
| 2026-08-17 | Rename the Java root package from `com.filemanagement` to `com.falcon` across `backend/src/main` and `backend/src/test` (96 files) plus `pom.xml`'s `groupId`. | User-requested mid-session; mechanical rename, no behavior change. Verified with a full `mvn test` run (all prior tests still pass under the new package). | Active; supersedes the 2026-08-12 `com.filemanagement` row above |
| 2026-08-17 | Begin the wizard/workflow "foundation" phase: relational schema (JDBC + H2, not JPA — matches the codebase's existing raw-SQL style, no prior ORM dependency), workflow/resume engine, and wizard screens 1-2 only; migrate the existing capture flow onto the new schema. Defer screens 3-8, market ticker, and the full assistant module. | Implementing all 21 activities / 12 tables / 5 new modules in one pass isn't compatible with this repo's TDD mandate. Screen 2's mock chat/voice UI is included in this phase (client-side deterministic mock only, no backend AI call) since `REQUIREMENTS.md`'s "Personal-information workspace POC" section requires it for the same screen being built. | Active — implementation starting |

## Safety and compliance boundaries

- Use only synthetic applicants and clearly marked synthetic/sample driver-license images.
- Do not collect, retain, log, or transmit real customer data, real driver licenses, biometric information, brokerage credentials, tax IDs, or payment information.
- Do not open a real brokerage account, execute trades, make account-opening decisions, provide suitability analysis, or offer investment/legal advice.
- Mock identity validation must always be labelled **Mock validation**. It is not KYC, AML, fraud detection, or legal identity verification.
- A real document-verification provider requires separately approved legal, privacy, security, vendor-contract, data-retention, and compliance work.
- Real-time market-data display and redistribution require a provider/exchange entitlement review. The POC begins with fixtures or delayed data.
- Russia/MOEX data remains disabled by default. It may be enabled only after explicit legal, sanctions, provider-entitlement, and configuration approval.

## Product scope

### Onboarding lifecycle

```text
DRAFT
  -> IDENTITY_CAPTURE_REQUESTED
  -> IDENTITY_CAPTURED
  -> IDENTITY_VALIDATED
  -> READY_FOR_REVIEW
```

- Invalid, expired, or consumed capture tokens never change onboarding state.
- All state changes are auditable with redacted, non-PII metadata.

### Identity-document capture

- A demo user creates a synthetic onboarding application.
- The application issues a short-lived, single-use, opaque capture-link token.
- A user opens `/capture/:token` on a mobile-friendly page.
- The capture page asks for browser camera permission only after the user chooses a capture action.
- The user captures or selects a synthetic front image, previews it, and may retake it.
- The user repeats this for the back image.
- Both front and back images are required before submission.
- The browser uploads only through controlled application endpoints or narrowly scoped upload URLs. It never sees storage-provider credentials.
- The backend validates file size, declared MIME type, decoded image type, and configurable image dimensions.
- Object keys are generated server-side using opaque identifiers and never contain names, license data, tokens, or other PII.
- Stored images are private under an application-scoped prefix in a dedicated test bucket. There are no public object URLs or public bucket listing.
- Persist only necessary metadata: side, object key, MIME type, byte size, checksum, capture timestamp, and status.
- The mock validator returns `VALIDATED` deterministically once both sides are stored successfully.
- The application transitions to `IDENTITY_VALIDATED`, then `READY_FOR_REVIEW`.

### Market ticker

The UI must support these global market indicators:

| Region / market | POC indicator |
| --- | --- |
| United States | Dow Jones Industrial Average |
| United States | Nasdaq Composite |
| Germany | DAX |
| China | Mainland China representative index, subject to provider symbol availability |
| South Korea | KOSPI |
| Japan | Nikkei 225 |
| France | CAC 40 |
| India | NIFTY 50 or Sensex, subject to provider symbol availability |
| Brazil | Ibovespa |
| Russia | MOEX Russia Index; disabled by default |

Every rendered indicator includes a value, change, source, as-of timestamp, and `fixture`, `delayed`, or `real-time` label. The browser cannot request unapproved markets or override their data mode.

### Conversational assistance and voice

- The POC provides mock onboarding assistance only.
- It must visibly say that responses are demonstrations and are not financial, legal, account-opening, or investment advice.
- The backend owns any future text, speech-to-text, and text-to-speech provider integration.
- The initial experience may use browser capture with server-side processing only when a provider is approved; otherwise voice controls remain disabled or labelled mock.
- No provider credential appears in React, browser network requests, source control, or logs.

## Architecture

```text
React static client
    -> API gateway / edge route
    -> Java Spring Boot onboarding service
       -> onboarding application and state machine
       -> capture-token service
       -> private storage adapter
       -> mock identity-validation adapter
       -> market-data adapter
       -> assistant/voice adapter
       -> persistence repositories
```

### Backend modules

| Module | Responsibility |
| --- | --- |
| `web` | Controllers, request validation, response DTOs, safe exception handling. |
| `application` | Use-case orchestration and transaction boundaries. |
| `domain` | State machine, lifecycle invariants, and cloud-neutral ports. |
| `persistence` | Application, token, document-metadata, and audit repositories. |
| `storage` | Private object-storage interface and provider adapters. |
| `validation` | Mock identity validator and future vendor adapter. |
| `marketdata` | Fixture and future Twelve Data normalization adapters. |
| `assistant` | Mock and future text/voice adapters. |

### Synchronous task-worker model

```text
API Gateway / controller -> onboarding-api-worker -> allowlisted TaskRegistry
  -> BaseTask.run() -> one TaskAction.execute() -> application service / adapter
  -> synchronous TaskResult
```

- `BaseTask.run()` supplies validation, timing, correlation IDs, redacted logging, safe error translation, and a stable result envelope.
- Each concrete task invokes one activity/action.
- Task resolution is allowlisted: clients cannot dynamically select a class, module, or handler.
- Only bounded work is synchronous; long-running work requires an explicitly designed asynchronous workflow.

### Frontend routes

| Route | Purpose |
| --- | --- |
| `/` | Resumable wizard entry (`OnboardingWizard`): screen 1 welcome/consent, screen 2 personal information; later screens not built yet. |
| `#/onboarding` | Legacy standalone start-application page (`StartApplicationPage`), kept as-is. |
| `#/upload` | The file-transfer demo (`UploadPage`) — moved here from bare `/` when the wizard became the landing page. |
| `#/capture/:token` | Mobile document capture and submission. |
| `#/downloads/:shareToken` | File-transfer demo's shared-download page. |

### API surface

| Method and route | Purpose | Status |
| --- | --- | --- |
| `POST /api/onboarding/applications` | Create synthetic `DRAFT` application; also completes activity 2 and initializes all 21 activity rows. | Implemented |
| `GET /api/onboarding/applications/{publicReference}` | Return safe application state. | Implemented |
| `GET /api/onboarding/applications/{publicReference}/resume` | Resume pointer, wizard screen, completion %, per-activity status, saved field values. | Implemented |
| `PUT /api/onboarding/applications/{publicReference}/activities/{n}` | Save an activity's draft field values (idempotent by request-supplied key); only activity 3 has real logic. | Implemented |
| `POST /api/onboarding/applications/{publicReference}/activities/{n}/continue` | Validate/complete an activity (idempotent); activity 1 completes consent, activity 3 runs the activity-4 mock pre-check. | Implemented |
| `POST /api/onboarding/applications/{publicReference}/capture-links` | Issue a one-time capture link. | Implemented |
| `GET /api/onboarding/captures/{token}` | Validate a capture token and return capture-step status. | Implemented |
| `PUT /api/onboarding/captures/{token}/documents/front` | Validate and store front image. | Implemented |
| `PUT /api/onboarding/captures/{token}/documents/back` | Validate/store back image and invoke mock validation when complete. | Implemented |
| `GET /api/markets/indicators` | Return normalized fixture/delayed indicators. | Planned |
| `POST /api/assistant/messages` | Return mock onboarding guidance (server-side assistant module). | Planned — screen 2's chat/voice today are client-side-only mocks, not this endpoint |

## User-story index

| ID | Story |
| --- | --- |
| ONB-001 | Start a synthetic onboarding application. |
| ONB-002 | Request an expiring identity-capture link. |
| ONB-003 | Capture front and back synthetic license images. |
| ONB-004 | Receive a visibly mock validation result. |
| MKT-001 | View responsibly labelled global market context. |
| AI-001 | Use mock guided onboarding assistance. |
| UI-ONB-001 | Create/view application with safe UI error handling. |
| UI-ONB-002 | Request/copy a capture link with expiry disclosure. |
| UI-CAP-001 | Deliberately request camera permission. |
| UI-CAP-002 | Capture, preview, retake, and submit both sides. |
| UI-CAP-003 | Safely handle invalid/expired/used capture links. |
| UI-MKT-001 | Render ticker source, timestamp, and data-status label. |
| UI-AI-001 | Use explicit mock assistance without browser secrets. |
| BE-ONB-001 | Enforce valid lifecycle transitions. |
| BE-TOKEN-001 | Generate hashed, opaque, expiring, single-use capture tokens. |
| BE-DOC-001 | Validate and privately store document images. |
| BE-VAL-001 | Run deterministic idempotent mock validation. |
| BE-MKT-001 | Normalize provider-neutral market data. |
| BE-AI-001 | Keep AI/voice integrations server-side. |
| DEP-001 | Run locally without external credentials. |
| DEP-002 | Build reproducible frontend and Java artifacts. |
| DEP-003 | Provision/reuse isolated demo resources idempotently. |
| DEP-004 | Configure secrets safely. |
| DEP-005 | Disable live providers by default. |
| DEP-006 | Deploy behind TLS and a controlled demo URL. |
| DEP-007 | Promote only verified builds and support rollback. |

## Onboarding-flow reference

The detailed [21-step onboarding flow](docs/brokerage-onboarding/04-onboarding-flow.md) covers landing disclosure through capture-link issuance, mobile front/back synthetic-document capture, private storage, deterministic mock validation, review-ready state, recovery behavior, and controlled test-data reset.

It is a design and implementation reference only, not a production KYC, account-opening, or regulated brokerage procedure.

## Provider decisions

### Market data

- Initial evaluation provider: **Twelve Data**, behind a `MarketDataProvider` adapter.
- Initial runtime mode: `fixture` locally; `delayed` only after validating applicable entitlement.
- Real-time display is off by default and requires provider/exchange redistribution approval for every displayed market.
- The backend normalizes values and communicates source/timestamp/data status to the client.

### AI and voice

- Initial runtime mode: `mock`.
- A paid ChatGPT subscription does not fund API calls. ChatGPT and OpenAI API billing are separate.
- Future live mode needs a separately billed OpenAI API account, server-side `OPENAI_API_KEY`, explicit spending limit, rate limiting, audit/redaction controls, and provider activation.

### Capture-link delivery

- Local default: show and copy the capture link on the onboarding page.
- Future live delivery requires a server-side email or SMS adapter, approved sender/domain, provider credentials, and consent/compliance review.

## Deployment and infrastructure

### Environments

| Environment | Data/provider mode |
| --- | --- |
| Local | Synthetic fixtures and mock adapters only; no credentials required. |
| Demo | Synthetic data; approved delayed feed only; mock validation by default. |
| Production | Not in scope until legal, privacy, security, licensing, and compliance approval. |

### Configuration contract

| Variable | Default / use | Security expectation |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | Public demo URL | Server controlled; do not infer from inbound Host headers. |
| `DOCUMENT_STORAGE_MODE` | Mock or private isolated store | Never public object storage. |
| `VALIDATION_MODE` | `mock` | Live validation requires explicit approval. |
| `MARKET_DATA_MODE` | `fixture` | Delayed/real-time requires approved entitlement. |
| `TWELVE_DATA_API_KEY` | Only when enabled | Server-only secret. |
| `AI_MODE` | `mock` | Live provider disabled by default. |
| `OPENAI_API_KEY` | Only when enabled | Server-only secret; separately billed API account. |
| `CAPTURE_LINK_TTL` | Short bounded duration | Environment-configurable. |
| `EMAIL_DELIVERY_MODE` | `copy-link` locally | Provider credentials remain server-side. |

### Cloud portability

- **Cloudflare:** host React static assets/edge route on Workers/Pages or a Worker custom domain; deploy Java separately on a JVM/container-capable service; use R2/D1 only through adapters.
- **AWS:** Java on ECS/Fargate, App Runner, or Lambda; adapters for S3, RDS/DynamoDB, Secrets Manager, and API Gateway.
- **Azure:** Java on Container Apps, App Service, or Functions; adapters for Blob Storage, Azure SQL/Cosmos DB, Key Vault, and Front Door.

## Testing strategy

- Unit tests: state machine, token hash/expiry/single-use, document validation, mock validator, market normalization, and mock assistant behavior.
- Controller tests: API validation, safe conflict responses, generic token errors, and absence of PII/secrets in responses.
- React component tests: onboarding screens, camera permission grant/denial, media-stream cleanup, front/back gating, retake flow, and accessibility labels.
- Integration tests: repositories, transactional state transitions, idempotent retries, and storage-port contracts.
- End-to-end tests: full synthetic journey from application creation through front/back capture and mock validated result.
- Infrastructure tests: idempotent resource provisioning, private storage, least-privilege bindings, configuration defaults, and smoke tests.
- Security tests: malformed/oversized image rejection, token enumeration resistance, no public object URL, safe logs, and no browser secrets.

## Definition of done

- Each indexed user story has normal-path and failure-path automated coverage.
- The full application runs locally with no external credentials and synthetic fixture data.
- All mock behavior and data status is visibly disclosed in the UI.
- The frontend, backend, and infrastructure build successfully with quality gates.
- Documentation explains setup, mock boundaries, provider activation, and explicit production-readiness gaps.

## Information still needed before enabling live integrations

Do **not** put these values in this file or chat. Use a local `.env` file or managed secret store.

1. An approved separate OpenAI API billing account and spend limit for live AI/voice.
2. A Twelve Data plan/key and confirmation of permitted delayed/real-time client display for the selected symbols.
3. Email or SMS provider, sender domain, and consent model if capture links will be delivered outside the local UI.
4. Dedicated demo storage/database resources and deployment permissions.
5. Optional production/demo hostname and DNS ownership when deployed publicly.
