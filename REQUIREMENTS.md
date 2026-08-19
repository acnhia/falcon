# Project requirements

## Working agreement

Every new user requirement must be recorded in this file before implementation work begins. The entry must state the requested behavior and any material safety boundary.

- Maintain a root-level `context.md` that consolidates the brokerage-onboarding POC context, requirements, decisions, safety boundaries, architecture, and implementation status. It must never contain credentials, real PII, or document images.
- Maintain the design guidelines and an append-only decision log in `context.md`. When the user explicitly asks to retain a discussion, requirement, architectural choice, or implementation decision, record its outcome there before related implementation work begins.

## Test-driven development

- New behavior must begin with a failing automated test, followed by the smallest implementation that makes it pass.
- Maintain focused test suites for the Java backend, React frontend, and Cloudflare infrastructure deployment layer.
- Tests must cover the normal path, validation failures, lifecycle or concurrency boundaries, and provider-integration contracts where feasible without contacting production resources.
- Run the relevant test suite after each behavior change; report any environment limitation that prevents execution.

## Java package namespace

- The Java application’s root namespace is `com.falcon` (renamed from `com.filemanagement` on 2026-08-17).
- All source and test package declarations, imports, and directory paths must use the same namespace so Spring component scanning remains rooted at the application class.

## Transfer records and sharing

- The Cloudflare serverless implementation must persist completed upload-transfer metadata in a managed relational database.
- Provision the database through the infrastructure project with idempotent behavior: create the resource if it does not exist and reuse it if it already exists.
- Each completed upload must receive a shareable download URL.
- The React application must show a dedicated post-upload download screen with the shareable URL and an accessible download action.
- The download route must retrieve the stored transfer record and stream the matching object from R2.
- D1 provisioning and schema migration must be safe to run repeatedly: an existing database and existing schema must be reused without destructive reset.
- Public download URLs must use an unguessable share token, not the internal upload-session identifier or object key.
- The Cloudflare deployment must serve the built React application as static assets while the same Worker handles its API and download routes.

## Test storage budget

- During testing, application-managed R2 storage must not exceed **10 GiB**.
- Before an upload starts, reserve its declared size. Reject the upload before any part is transferred when the reservation would exceed the limit.
- On a quota rejection, the user must be offered an explicit choice to delete prior **test uploads** and retry. No deletion occurs without that explicit confirmation.
- Deletion is limited to objects owned by this application under the `uploads/` prefix. It must not delete unrelated bucket content.
- The quota only accounts for application-managed uploads. Existing or externally-created objects require a separately configured baseline before the limit can be treated as total bucket usage.

## Test bucket isolation

- All local and test uploads must use a dedicated R2 bucket, separate from any future production bucket.
- The test bucket name must be configured through `BUCKET_NAME` in the local environment file rather than embedded in application code.
- The test bucket remains subject to the 10 GiB application storage ceiling and the explicit, prefix-scoped test-data deletion flow.

## Upload speed feedback

- While a file is uploading, the UI must show its current effective upload speed.
- When the upload finishes, keep a clear completion message showing the effective upload speed achieved for the whole file.
- Express speeds in human-readable binary units, such as KiB/s, MiB/s, or GiB/s.
- Calculate the effective speed from bytes reported uploaded by the browser and elapsed wall-clock time for that upload attempt.

## Brokerage onboarding partner POC

- Build the brokerage-onboarding demonstration as a new, separate application area. It must not be mixed into the file-transfer application’s production code paths.
- The POC must demonstrate a React client, a Java/Spring Boot backend, provider-neutral adapters, automated tests, containerized local execution, and cloud-deployable infrastructure.
- The interface must include a global-market ticker bar for: Dow Jones, Nasdaq, Germany, China, South Korea, Japan, France, India, Brazil, and Russia. Each displayed quote must show its source, last-update timestamp, and whether it is delayed or real-time.
- Use a market-data adapter so vendors can be replaced without changing UI or onboarding business logic. Twelve Data is the initial POC evaluation provider.
- The initial POC must use delayed or fixture market data unless an approved provider contract explicitly permits real-time public display and redistribution for each requested market. Russia/MOEX data must remain disabled unless legal, sanctions, and provider-entitlement review explicitly approves it.
- The POC may demonstrate conversational text and voice guidance, but it must not provide investment recommendations, trading execution, account-opening decisions, or other regulated financial advice.
- All applicant identities, documents, account details, and market values used in demos must be synthetic. No real customer PII or brokerage credentials may be stored or sent to an AI or market-data provider.
- AI provider credentials must remain server-side in an environment/secret store and must never be included in React code, a browser request, source control, or logs.
- A ChatGPT subscription cannot be used as the application’s API budget. Before live AI integration, an approved API-platform billing account and spend limit must be configured. Until then, the application must run in an explicit mock-AI mode.
- Voice integration must be designed behind a provider-neutral interface. The first version may use browser capture plus server-side speech-to-text, text response, and text-to-speech rather than exposing credentials to the client.

### Synchronous task-worker API model

- Implement onboarding activities using an Otterobot-inspired task-worker model: a high-level task has a public `run()` function that applies shared validation, timing, redacted logging, and error mapping, then invokes one specific action to perform the activity.
- Expose eligible activities as synchronous APIs through a provider-neutral API-gateway-to-worker boundary. Each response must return a stable task name, status, correlation ID, duration, and safe output/error contract.
- Resolve task names through an explicit allowlisted task registry. Do not dynamically load classes/modules from client-supplied names or allow callers to select implementation classes.
- Use responsibility-based worker names, such as `onboarding-api-worker`, not provider-specific names in application code. Map the worker to AWS Lambda, Azure Functions, a container, or an edge gateway only in infrastructure adapters.
- Synchronous task APIs are only for bounded request work. Any activity that can exceed platform/request limits must have a separately documented asynchronous workflow and must not hold HTTP connections open indefinitely.

### Account-onboarding workflow

- Maintain a detailed 21-step account-onboarding flow document that identifies the user action, system action, state transition, data boundary, and test expectation for every step.
- The POC must demonstrate a stateful brokerage-account onboarding workflow using synthetic applicant data only. Suggested states are: `DRAFT`, `IDENTITY_CAPTURE_REQUESTED`, `IDENTITY_CAPTURED`, `IDENTITY_VALIDATED`, and `READY_FOR_REVIEW`.
- A user must be able to start an onboarding application from the React UI and receive an identity-document capture link for that application.
- The capture link must contain an opaque, unguessable, single-purpose token. It must not expose an internal application ID, user ID, storage key, or driver-license information.
- The capture link must have a short configurable expiry, be usable only for the intended identity-capture step, and be invalidated after successful document submission. Expired, invalid, or already-used links must return a safe generic error without revealing applicant information.
- Opening the capture link must render a mobile-friendly React capture page. It must request browser camera access only after the user explicitly selects a capture action.
- The capture page must guide the user through distinct front and back driver-license images. It must show previews, allow retakes before upload, and require both sides before submission.
- The browser must upload captured images only through authenticated, application-controlled upload endpoints or narrowly scoped upload URLs. It must never expose storage-provider credentials in the browser.
- Driver-license images are highly sensitive personal data. The POC must use only synthetic/sample images; no real license, customer PII, or biometric data may be captured, retained, logged, or sent to external providers.
- Uploaded images must be stored under an application-scoped, non-public prefix in the dedicated test storage bucket. Object keys must be generated server-side and must not include applicant names, license numbers, or other PII.
- The storage layer must apply size, MIME-type, and image-decode validation before accepting a document. It must reject unsupported content and must not serve document objects through a public bucket URL.
- The backend must persist document metadata and capture state, but never store license numbers or extracted identity fields in the mock implementation.
- The POC validation service must be an explicit mock adapter. After both document images are successfully stored, it must return a deterministic mock `VALIDATED` result and transition the application to `IDENTITY_VALIDATED`.
- The UI must visibly label the result as a mock validation and must not claim that a real identity, KYC, AML, or fraud check occurred.
- A future real document-verification provider must be introduced behind the same validation interface. It requires separate legal, privacy, security, vendor-contract, retention, and compliance approval before activation.
- Tests must cover capture-link expiry and single-use behavior, front/back requirement, upload validation failures, storage-key privacy, state transitions, mock-validation response, and UI permission/error paths.

### Personal-information workspace POC

- The first full onboarding workspace must use a dark, accessible two-panel desktop layout: synthetic personal-information form on the left and a persistent guided chat on the right, with a voice-input control at the bottom of the chat panel.
- This personal-information workspace is the landing page for the brokerage-onboarding POC. It must be served at the root route `/`; `/onboarding` may redirect there during the POC phase.
- It must identify the current workflow location as **Personal information — stage 2 of 21**, and must show later stages as progress/status rather than imply they are implemented.
- Text and mock voice interactions may propose values for supported form fields, but values must remain editable and require explicit user acceptance before populating a form field. The assistant must never silently submit, overwrite, or make a regulated decision.
- This iteration uses deterministic mock assistant and voice behavior only. It must present an explicit synthetic/demo and mock-assistance disclosure; real PII, audio, browser-stored transcripts, provider secrets, live AI, or live voice services are prohibited.
- Microphone permission must be explicitly user initiated and denial must retain a fully functional text path. The screen must work responsively and with keyboard navigation.
- The dark fintech visual direction may use a restrained green accent for active/successful states, but it must be an original UI. Do not copy Robinhood or any other company’s branding, screen layouts, assets, component designs, or distinctive trade dress.

### Resumable account-onboarding wizard

- The account-onboarding POC has 21 workflow activities but must use a smaller, intuitive set of user-facing wizard screens. Activities that are background checks, derivations, or system operations must show status and recovery information rather than unnecessarily forcing a separate screen.
- The detailed activity-to-screen mapping, normalized persistence model, retry/resume rules, and logical module boundaries are maintained in `docs/brokerage-onboarding/05-wizard-data-and-services.md`.
- A partially complete application must resume at the earliest incomplete required activity using server-persisted state. Each save/continue/check request must be idempotent and safe to retry.
- Derived/API fields are mock-provider outputs in this POC, visibly labelled with source and status. Users may correct relevant source data; the system must invalidate and rerun dependent derived checks.
- Begin with a modular monolith behind `onboarding-api-worker`; do not create a microservice per workflow activity without a demonstrated ownership, scaling, or deployment need.
- Consolidate the 21 internal workflow activities into four user-facing sections: Identity and residency; Financial profile and account choices; Verification, contacts, and agreements; Review and submit. Background checks must appear in an accessible bottom status rail rather than as separate wizard screens.
- The canonical user stories, fields, status messaging, backend responsibilities, and test expectations are in `docs/brokerage-onboarding/06-wizard-component-user-stories.md`.
