# Brokerage onboarding partner POC — backend requirements

## Scope

Java 21 and Spring Boot implement the onboarding state machine, capture-token lifecycle, document-upload authorization and validation, mock identity validation, market-data adapter, and mock AI/voice adapter.

## Logical modules

| Module | Responsibility |
| --- | --- |
| `web` | HTTP controllers, request validation, response DTOs, safe exception mapping. |
| `application` | Onboarding use cases and transaction boundaries. |
| `domain` | Application state, invariants, ports, and lifecycle rules. |
| `storage` | Private object-storage port and mock/cloud adapters. |
| `validation` | Mock identity-validation port and future provider adapters. |
| `marketdata` | Fixture/Twelve-Data market-data port and normalization. |
| `assistant` | Mock AI/voice port and future provider adapters. |
| `persistence` | Application, capture-token, and document-metadata repositories. |
| `workflow` | 21-activity state, prerequisite rules, resume/checkpoint, stale dependencies, and idempotency. |

## Synchronous task-worker model

The POC adopts the useful structure of the Otterobot task model while keeping task dispatch safe and provider-neutral.

```text
API Gateway / HTTP controller
    -> onboarding-api-worker
       -> TaskRegistry (allowlisted task name -> task factory)
          -> BaseTask.run(context)
             -> specific TaskAction.execute(context)
                -> application service / adapter
    <- synchronous TaskResult
```

### Core contracts

```java
public interface TaskAction<I, O> {
    O execute(I input, TaskContext context);
}

public abstract class BaseTask<I, O> {
    public final TaskResult<O> run(I input, TaskContext context) {
        // validation, timing, redacted logs, safe errors, and action execution
    }
}
```

- A concrete task has one responsibility and delegates its activity to one `TaskAction` implementation.
- `run()` owns validation, correlation ID, authorization context, bounded timing, redacted logs, error translation, and result-envelope creation.
- `execute()` owns the activity-specific behavior only.
- `TaskRegistry` is a configured allowlist. The client cannot pass a class name, module path, or arbitrary handler.
- `TaskResult` returns `status`, `taskName`, `correlationId`, `durationMs`, optional safe output, and a safe error code/message. It never returns stacks, tokens, document bytes, object keys, or PII.
- HTTP controllers map routes to specific task names; clients do not receive a generic “run arbitrary task” endpoint.

### Initial task catalogue

| Task name | Specific action | Synchronous contract |
| --- | --- | --- |
| `CreateOnboardingApplication` | Create synthetic application | Returns public reference and `DRAFT`. |
| `IssueIdentityCaptureLink` | Generate/hash capture token | Returns opaque URL and expiry. |
| `GetCaptureSession` | Validate capture token | Returns safe capture-step status. |
| `StoreFrontDocument` | Validate/store front | Returns front acceptance. |
| `StoreBackDocument` | Validate/store back | Returns back acceptance and lifecycle state. |
| `CompleteMockValidation` | Deterministic mock validation | Returns explicit mock `VALIDATED`. |
| `GetMarketIndicators` | Fixture/delayed market lookup | Returns normalized indicators. |
| `RespondToOnboardingQuestion` | Mock assistant | Returns non-advisory mock guidance. |

### Worker deployment boundary

- Name the logical entry point `onboarding-api-worker`.
- **Cloudflare:** a Worker may provide the API-gateway/edge boundary but forwards synchronous task calls to the Java service; it does not run Java task classes.
- **AWS:** API Gateway can synchronously invoke a Java Lambda implementation of the worker, or route to a Java container service.
- **Azure:** API Management/Front Door can route synchronously to a Java Azure Function or container service.
- The Java task/action model stays unchanged across platforms.

### Bounded execution rule

- Document validation, mock validation, token validation, status reads, fixture market lookup, and mock assistant response are eligible synchronous activities.
- Future OCR, live verification, email/SMS retries, long voice processing, and unbounded provider calls require an explicit asynchronous workflow.

## Resumable wizard backend requirements

- The backend models 21 workflow activities independently of the smaller 8-screen UI. Each activity has a persisted status, prerequisite rule, timestamps, and a safe blocked/retry reason.
- `SaveActivityDraft` and `ContinueActivity` persist a server-side checkpoint transactionally and return the current wizard screen, current activity, earliest incomplete required activity, and truthful completion percentage.
- The application resumes from persisted activity status, never a browser-only progress marker. Changes to upstream source fields mark dependent mock checks and downstream activities stale.
- Every state-changing task requires an idempotency key and correlation ID. Duplicate retries must return the existing safe result without duplicate documents, acknowledgements, checks, or application creation.
- Store scalar field values against a versioned field-definition catalogue. Addresses, documents, provider checks, acknowledgements, agreements, operations, and audit events use their own normalized repositories/entities.
- Mock assistant/voice actions may return field proposals but require an explicit `AcceptAssistantProposal` action before a value becomes confirmed. They cannot silently overwrite confirmed user values.

## API contracts

| Method and path | Behavior |
| --- | --- |
| `POST /api/onboarding/applications` | Creates synthetic `DRAFT` application. |
| `GET /api/onboarding/applications/{publicReference}` | Returns safe lifecycle status. |
| `POST /api/onboarding/applications/{publicReference}/capture-links` | Issues capture token and transitions to capture requested. |
| `GET /api/onboarding/captures/{token}` | Validates token and returns capture-step status only. |
| `PUT /api/onboarding/captures/{token}/documents/front` | Validates and stores front image. |
| `PUT /api/onboarding/captures/{token}/documents/back` | Validates and stores back image; invokes mock validator once both are accepted. |
| `GET /api/markets/indicators` | Returns normalized fixture/delayed market indicators. |
| `POST /api/assistant/messages` | Returns explicit mock onboarding guidance. |

## User stories

### BE-ONB-001 — Enforce onboarding transitions

**As the system,** I allow only valid lifecycle transitions so that a capture or validation cannot be skipped.

**Acceptance criteria**

- Invalid transitions return a conflict response without changing persisted state.
- State changes include a timestamped audit event with no PII.
- Repeated safe reads are idempotent.

### BE-TOKEN-001 — Issue secure capture links

**As the system,** I issue short-lived one-time capture tokens so that document upload authorization is narrowly scoped.

**Acceptance criteria**

- Tokens use cryptographically secure randomness and are stored only as a one-way hash.
- Token validation enforces configured expiry, intended application, and single-use state.
- Invalid, expired, and consumed tokens use the same safe external response.

### BE-DOC-001 — Validate and store document images privately

**As the system,** I accept only valid synthetic document images and store them privately.

**Acceptance criteria**

- Validate request size, declared MIME type, decoded image type, and configurable pixel dimensions.
- Reject empty, malformed, unsupported, or over-limit documents before persistence.
- Generate server-side object keys using opaque identifiers; never use names, license values, or tokens.
- Store only metadata required by the POC: side, object key, MIME type, byte size, checksum, capture timestamp, and status.

### BE-VAL-001 — Run deterministic mock validation

**As the system,** I return a deterministic mock validation result when both sides are present.

**Acceptance criteria**

- The mock adapter performs no OCR, biometric processing, external request, or identity decision.
- It returns `VALIDATED` only after both sides have accepted storage metadata.
- It is invoked once per completed capture session; retries are idempotent.

### BE-MKT-001 — Isolate market-data provider behavior

**As the system,** I normalize market data behind a port so that the provider can change safely.

**Acceptance criteria**

- The fixture adapter is the local default and provides source/time/delay metadata.
- A Twelve Data adapter is configured only when its server-side key and approved entitlement are present.
- Russia/MOEX is disabled by default and cannot be enabled by a browser request.

### BE-AI-001 — Keep AI and voice integration server-side

**As the system,** I provide mock onboarding assistance without exposing AI credentials.

**Acceptance criteria**

- Mock mode is default and returns non-advisory, onboarding-only responses.
- The provider port supports future text, speech-to-text, and text-to-speech implementations.
- API keys, request bodies containing sensitive information, and response telemetry are never logged.

### BE-WORKER-001 — Dispatch only approved task activities

**As the system,** I route synchronous API work through an allowlisted task worker so that clients cannot invoke arbitrary code.

**Acceptance criteria**

- Each supported route maps to a stable approved task name.
- Unknown task names and invalid task input return safe errors and never execute a dynamically chosen class/module.
- Every result includes task name, correlation ID, status, and duration but no sensitive internals.
- The task wrapper performs redacted logging and translates unexpected exceptions to a safe server error.

## Security and operations

- Inject all secrets through environment variables or a managed secret store; never commit them.
- Disable public object listing and direct object URLs for identity-document storage.
- Apply request-size limits, rate limits, content validation, safe error handling, and structured redacted logs.
- Include health and readiness endpoints that do not reveal configuration or provider secrets.
- Use a dedicated test bucket and database. Cleanup must be explicit, scoped, and auditable.

## Backend testing

- Unit tests: state machine, token hashing/expiry/single-use, document validation, mock validator, market normalization, and assistant responses.
- Controller tests: request validation, conflict responses, generic token errors, and no-secret/PII response assertions.
- Integration tests: repository persistence, object-storage port contract, transactional transitions, and idempotent retries.
- Contract tests: storage, market-data, AI, and validation ports against mock adapters.
- Security tests: oversized/malformed file rejection, token enumeration resistance, no public storage URL, and log-redaction assertions.
- Implement the four-section wizard's persistence, bounded mock checks, status-rail responses, retry/idempotency behavior, and provider-neutral task stories in [wizard component user stories](06-wizard-component-user-stories.md).
