# Brokerage onboarding partner POC — working context

Last updated: 2026-08-18

## Purpose

Build a partner-facing proof of concept that demonstrates a modern brokerage-account onboarding experience and the organisation's engineering capability. The POC combines a React frontend, Java/Spring Boot backend, provider-neutral integrations, automated tests, containerized local execution, and cloud-portable deployment.

This is a **demonstration only**, not a production brokerage service.

## Current status

- The existing repository contains a separate multipart file-transfer demo under `backend/`, `react/`, and `infra/`.
- **Live deployment:** https://<your-subdomain>.workers.dev (Cloudflare Worker `aom-demo`) serves the onboarding wizard at root `/` and the file-transfer demo at `#/upload` from one deploy (see routes table below). Redeploy via `cd infra/cloudflare && npm run launch:docker` (containerized; builds, tests, provisions R2/D1, deploys). Bindings: R2 bucket `test` (`UPLOADS`), D1 `upload-transfer-test` (`TRANSFERS`), D1 `onboarding-test` (`ONBOARDING_DB`), Worker secret `OPENAI_API_KEY` (set from root `.env`'s `OPENAPI_KEY` by `scripts/provision-openai-secret.mjs`).
- The account-onboarding **identity-capture slice** (start application → capture-link token → front/back document capture → mock validation → `READY_FOR_REVIEW`) is implemented end-to-end and tested in the **Java backend** (`backend/`, JDBC/H2 persistence) — this remains the reference implementation for local/container dev and its own test suite.
- The **wizard/workflow "foundation" phase** (activities 1–4 of 21, wizard screens 1–2 of 8; see [wizard, normalized data, and service design](docs/brokerage-onboarding/05-wizard-data-and-services.md)) is implemented and tested **twice, in parallel**, because Cloudflare Workers can't run the Spring Boot JAR:
  - **Java backend** (`com.falcon.onboarding`, `backend/`): `spring-boot-starter-jdbc` + H2 (file-based locally, in-memory for tests), an idempotent `schema.sql` covering 9 of the doc's 12 tables (`onboarding_application`, `onboarding_activity`, `field_definition`, `application_field_value`, `identity_capture_session`, `identity_document`, `provider_check`, `workflow_operation`, `application_audit_event`), a `repository.jdbc` package, a `workflow` package (`ActivityProgressService`, `AgeIdentityPrecheckService`), and `WizardOrchestrator`/`DefaultWizardOrchestrator` (kept separate from `OnboardingOrchestrator` so the capture-flow contract/tests stay untouched) exposing `GetResumeState`/`SaveActivityDraft`/`ContinueActivity` through the same `TaskRegistry` pattern. 33 test classes passing (`mvn test` via `docker run maven:3.9-eclipse-temurin-21`). Used for local/container dev only — **not what the live deploy runs**.
  - **Cloudflare Worker** (`infra/cloudflare/src/onboarding/`, TypeScript against D1): a second, parallel implementation of the identical API contract (`db.ts`, `applications.ts`, `activities.ts`, `captures.ts`, `documentValidation.ts` with header-based JPEG/PNG dimension parsing since Workers has no image decoder, `assistant.ts` for the voice session, `router.ts` dispatching `/api/onboarding/*`). Own D1 database `ONBOARDING_DB`/`onboarding-test`, reuses the existing R2 bucket under an `onboarding/` prefix. Concurrency (single-fire mock validation, single-use capture token) via conditional D1 `UPDATE ... WHERE x = 0` + checked `meta.changes`, no Durable Object needed. **This is what https://<your-subdomain>.workers.dev actually runs.** 30 Worker tests passing (`cd infra/cloudflare && npm test`), including `fieldExtraction.ts` (the second live AI call - see "AI and voice" below).
  - Frontend (`react/src/onboarding/`, shared by both backends since it just calls relative `/api/...`): `WelcomePage.tsx` (screen 1: consent, create-or-resume via a `localStorage`-held public reference), `PersonalInformationPage.tsx` (screen 2: dark two-panel layout, field-catalogue-driven form with 40+ fields across 10 grouped sections - see `docs/06`'s UI-S1-002 for the full list - save-draft/continue, completion bar, a full chat window with a text composer + voice button, not just a suggestion trigger), `OnboardingWizard.tsx` (container picking screen 1/2/"not built yet" from server-reported `wizardScreen`), `RestartButton.tsx` (confirm-then-clear-session control on every wizard stage), `realtimeVoice.ts` (real OpenAI Realtime API/WebRTC voice, including live streaming transcript deltas - see "AI and voice" below). `mockAssistant.ts`'s canned-suggestion mechanism was deleted, superseded by the composer's extraction-call proposals. Chat log auto-scrolls to the newest message unless the user has scrolled up (sticky-scroll); the composer's send/mic controls are square icon buttons side by side. `App.jsx`'s bare `/` serves the wizard; file-transfer demo moved to `#/upload`. 14 test files / 78 tests passing (`npm test`), `tsc --noEmit`, `npm run build`, `oxlint` all clean.
  - Deferred: wizard screens 3–8, `application_address`/`application_disclosure_acknowledgement`/`application_agreement_acceptance` tables, the general stale-dependency graph (only the activity-3→4 date-of-birth edge exists), the market ticker, and the full `marketdata`/`verification`/`disclosures`/`notifications`/`decisioning` modules.
  - Known gap, called out deliberately: `application_field_value.value` (Java) / `value` column (Worker/D1) is stored as plain text in this POC (only ever synthetic data by design); real production use would need encryption/key management for that column.
  - Not yet done: a full `docker compose up --build` manual smoke test of the Java-backend end-to-end journey (automated test suites cover it; not run manually to avoid touching live Cloudflare credentials in the root `.env`). The **Cloudflare-deployed** journey *has* been manually smoke-tested end to end (create → resume → consent → personal info → mock precheck → capture link → front/back upload → `READY_FOR_REVIEW`; token reuse correctly rejected; voice propose/confirm flow confirmed working live, including hearing the assistant's spoken audio).
- **Live voice is real, not mock:** the personal-information screen's voice control is a genuine OpenAI Realtime API (WebRTC) session — see "AI and voice" below for the full design and safety mechanics. This is the one live AI integration in the codebase; everything else stays mock.
- The planned application must be built separately from the file-transfer demo’s production code paths.
- Detailed source requirements live in:
  - [Overview](docs/brokerage-onboarding/00-overview.md)
  - [Frontend](docs/brokerage-onboarding/01-frontend.md)
  - [Backend](docs/brokerage-onboarding/02-backend.md)
  - [Deployment](docs/brokerage-onboarding/03-deployment.md)
  - [Detailed 21-step onboarding flow](docs/brokerage-onboarding/04-onboarding-flow.md)
  - [Wizard, normalized data, and service design](docs/brokerage-onboarding/05-wizard-data-and-services.md)
  - [Four-section wizard component user stories](docs/brokerage-onboarding/06-wizard-component-user-stories.md)
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
| 2026-08-18 | Consolidate the 21 onboarding workflow activities into four user-facing sections. | Identity/residency; financial profile/account choices; verification/contacts/agreements; review/submit. Background validation is shown via a bottom status rail and does not require a separate page. | Active — requirements recorded; implementation not started |
| 2026-08-18 | Deploy the onboarding API (activities 1-4, identity capture) to Cloudflare as a second, parallel TypeScript implementation on the *existing* Worker (`infra/cloudflare/src/onboarding/`), with its own D1 database (`ONBOARDING_DB`) and the existing R2 bucket under a new `onboarding/` prefix — not a separate Worker/deployable, and not a proxy to a separately-hosted Java service. | Cloudflare Workers cannot run the Spring Boot JAR (no JVM); the user explicitly wants the frontend calling Workers directly, not a JVM host. Reused the existing "package/route isolation inside one deployable, not a new one" precedent from the Java/React layers rather than doubling Worker/wrangler scaffolding for a POC slice. The Java backend stays the reference implementation for local/container dev. One documented gap: document validation uses header-based magic-byte/dimension parsing (JPEG/PNG) instead of full image decode, since Workers has no `ImageIO` equivalent. | Active — implemented and tested (17 Worker tests passing) |
| 2026-08-18 | Replace the personal-information screen's mock voice control with real browser speech-to-text (Web Speech API) plus a real, narrow-scope OpenAI extraction call (`gpt-4o-mini`, one field per utterance) on the Cloudflare Worker; add a pulsing "orb" UI indicator for listening/thinking states. | User tried the mock voice control, found it did nothing real, and confirmed they have an approved OpenAI API account. Kept scope narrow (one structured extraction call, no general chat/TTS) and the key server-side-only (Worker secret) per `REQUIREMENTS.md`. Unsupported browsers (Safari/Firefox lack the Web Speech API) and denied mic permission both fall back to the existing fully-functional text-chat path. | **Superseded** same day by the Realtime-API row below, before this ever shipped to users as the final behavior |
| 2026-08-18 | Switch the voice control again, same day, to OpenAI's **Realtime API** over WebRTC (live speech-to-speech) instead of Web Speech API + one-shot extraction. Server mints a short-lived ephemeral client secret (`POST /v1/realtime/client_secrets`, real `OPENAI_API_KEY` never leaves the Worker); browser opens a direct WebRTC session to OpenAI (`POST /v1/realtime/calls` for SDP offer/answer) using only that ephemeral secret. A `suggest_field_value` tool call is the only way the model can propose a value - it still never fills a field directly. Hard 3-minute session auto-close plus an explicit "End voice session" control bound the per-minute billing. | User added `.env` entries (`Realtime_client_secret`, `Realtime_WebRTC`) signaling they specifically wanted the Realtime API, not the simpler extraction call; confirmed via direct question that this should *replace*, not sit alongside, the just-built version - removed `speechRecognition.ts` and the `/assistant/extract` endpoint rather than keeping two parallel voice systems. API contract verified against OpenAI's current docs at implementation time (fetched live, since this API's shape changes). | **Superseded** same day by the propose/confirm row below - the single `suggest_field_value` tool call also *applied* the value, but the user wanted the accept/reject step itself to happen by voice, not a button click |
| 2026-08-18 | Split the single `suggest_field_value` tool into **`propose_field_value` + `confirm_field_value`**, and made confirmation itself a spoken interaction: the model must ask out loud ("Should I use X for Y?") and get a verbal yes before calling `confirm_field_value`; only then does the client apply the value - no button click in the voice path. Enforced client-side, not just via prompt wording: `confirm_field_value` for a field is silently ignored unless that exact field was actually proposed first (`realtimeVoice.ts` tracks pending proposals). Also fixed a real bug found in live testing: the model's spoken audio was never actually audible (the `Audio` element was created but never attached to the DOM or explicitly `.play()`ed) - fixed by appending it (hidden) and calling `.play()` on `ontrack`. | Live testing surfaced two problems: (1) the assistant's voice couldn't be heard at all, and (2) requiring a manual "Use this" click defeated the purpose of a voice-native flow the user explicitly asked for. The two-tool split (rather than trusting the model to only call one tool at the right time) keeps the "never silently fill a field" safety property enforceable in code, not just in the prompt. | Active — implemented and tested (66 React tests, 22 Worker tests) |
| 2026-08-18 | Fixed wizard buttons rendering in the base app's purple (`--accent`) instead of any wizard-specific color - `.wizard-dark` only themed backgrounds/panels/orb, never overrode the global `button` rule. Restyled wizard buttons as outlined (accent-colored border/text, transparent fill) by default, filled solid only for an active state (e.g. the mic button while a voice session is live). | User reported still seeing "old UI" after the earlier Robinhood-palette-avoidance change; root cause was this gap, not a caching issue or a reversal of the original palette decision - the distinct teal/charcoal palette was live, but never reached the buttons. | Active |
| 2026-08-18 | Declined a request to match Robinhood's exact black/green color palette from a supplied screenshot; adjusted the wizard's dark theme to a deliberately distinct palette instead (charcoal-leaning `#0d0f13` background, teal-leaning `#2dd4bf` accent, was `#0f1115`/`#34d399`). | `REQUIREMENTS.md`'s "Personal-information workspace POC" section explicitly requires an original UI and forbids copying Robinhood's (or any company's) branding/trade dress - flagged directly rather than silently complying or silently ignoring the request. User agreed to keep a similar dark-plus-green mood with a distinct palette rather than amending that requirement. | **Refined** same day (see next row) - not a reversal, the "no exact match" boundary held |
| 2026-08-18 | User repeated the same request ("get the exact color"); held the same boundary again rather than complying on repetition, but addressed the underlying legitimate complaint (the charcoal/teal combination didn't read as clearly "black + green"). Pushed the palette bolder while keeping specific values distinct from Robinhood's: background `#050505` (true near-black, was `#0d0f13`), accent `#22c55e` (a true, vivid green - distinct from Robinhood's yellow-lime `~#00C805` - was the teal `#2dd4bf`). | A repeated request doesn't override a written requirement on its own, so the boundary was re-explained rather than quietly relaxed; offered the same two paths as before (bolder-but-distinct, or formally amend `REQUIREMENTS.md`) and the user again chose to stay distinct. | Active |
| 2026-08-18 | Add a "Restart" control to every wizard stage (welcome, personal information, and the later-screens placeholder), confirming before it clears the `localStorage` resume pointer and returns to the welcome screen - a new session begins once the user re-completes consent there, rather than the restart action itself silently creating a fresh application. | User asked for a way to abandon the current session and start over from any stage, mirroring the existing resumable-session model rather than adding a second one. Shared as one `RestartButton` component (confirm dialog + callback) rather than duplicating the confirmation copy per screen. | Active — implemented and tested (`RestartButton.tsx`, `OnboardingWizard.test.tsx`); scoped to the new wizard only, not the older standalone `#/onboarding`/`#/capture/:token` flow |
| 2026-08-18 | Stream the assistant's spoken voice response into the chat log as it's spoken (typing-in effect keyed by the Realtime API's `item_id`, appending `response.output_audio_transcript.delta` chunks to one message until `.done`), instead of only showing the model's pre-formed `propose_field_value` tool-call argument as a single instant message. Also: sticky-scroll chat log (auto-scrolls to the newest message unless the user has scrolled up to read history, matching the Claude-Code-in-VS-Code pattern the user pointed to), and restyled the "ask for a suggestion"/voice controls as two square icon buttons side by side (💬/🎤) with the live-session orb now a small badge on the mic button's corner instead of a separate element. | User wanted to both hear and read the response as it comes through, not just after. Verified the exact event names (`response.output_audio_transcript.delta`/`.done`, field `delta`) against OpenAI's current Realtime API docs (fetched live) rather than assuming the older API version's `response.audio_transcript.*` names still applied. Dropped the old `onPropose`-triggered chat message entirely, since it would otherwise duplicate the same spoken text now shown live by the transcript stream. | Active — implemented and tested (77 React tests, 22 Worker tests unaffected since this is frontend-only); deployed |
| 2026-08-18 | Expand the Personal Information screen's field catalogue (activity 3) using `account_opening_fields.md` (a real brokerage account-opening form's field inventory, captured by walking the live app with synthetic data) as the realism reference: name suffix, required mobile phone, full US-shaped residential address, optional mailing address, marital status, citizenship, and the reference brokerage's "Regulatory & affiliations" questions (broker-dealer affiliation, control-person status, politically-exposed-person status). All folded into the **same** activity-3 screen rather than the separate "address and tax residency" screen the original 21-activity docs envisioned, and rather than a new activity/screen for the regulatory questions — reconciling the user's explicit choice to keep this to the one already-built screen with their separate choice to include the regulatory questions anyway. New `FieldDataType` values `BOOLEAN`/`ENUM` with a narrow, new server-side allowlist check for the enum-typed fields (a real gap before this: `data_type` existed since day one but was never enforced for *any* field). **No real SSN/tax-ID field** — held as non-negotiable per the standing safety boundary, despite SSN being central to the reference brokerage's own real gating logic. Kept in parity across both backends (Java reference + the live Worker). | User reviewed the field inventory directly and asked for "as realistic a form as possible"; explicitly chose (a) fold into the existing screen rather than build a new one, (b) include the regulatory questions now despite no existing activity for them, (c) use a real OpenAI extraction call for paste-to-fill rather than regex (see next row). Full format/regex validation (email/phone/date/ZIP) remains a deliberately deferred, documented gap — this pass only adds allowlist checks for the new enum/boolean fields, not a general validation framework. | Active — implemented (33 Java test classes, 30 Worker tests, 78 React tests), deployed |
| 2026-08-18 | Replace the "guided assistant" panel's single "Ask for a suggestion" button with a full chat-window composer (persistent text input + send button, ChatGPT-style, alongside the existing mic button) and unify it with the requested "paste a blob of personal info to populate fields" feature into one pipeline: any sent/pasted text is run through a **second** live OpenAI call — a narrow-scope structured-extraction request (Worker-only, mirroring voice's existing Worker-only scope since Java isn't deployed live) that proposes field values found in the text, via the same `Use this`-confirmation UI already used for voice proposals. Deleted `mockAssistant.ts`'s canned-suggestion mechanism entirely (superseded). Deliberately **not** a general-purpose conversational assistant — the reply is a templated acknowledgment of what was/wasn't extracted, not a free-form LLM chat response; that would be a materially larger scope change against the standing "no general chat" boundary. | User asked in two follow-up messages (chat-window redesign, then paste-to-fill) that turned out to describe the same underlying capability — building one composer/pipeline instead of two avoids redundant UI and duplicate extraction logic. Flagged the general-chat-vs-extraction-only boundary explicitly during planning rather than silently expanding scope. | Active — implemented and deployed; supersedes the "voice is the only live AI call" framing in "AI and voice" below |
| 2026-08-18 | Completed the brokerage-inspired field set: added Section 2 (Employment & finances - employment status, conditional employer details, coarse income/net-worth/liquid-net-worth ranges, tax bracket, source of funds) and the remaining Section 4 fields (investment objective, risk tolerance, investment experience, time horizon, trusted contact, account-feature toggles, delivery preference, cost-basis method, W-9/e-signature acknowledgements) to the same activity-3 screen. Documented simplifications versus the real form: `sourceOfFunds` and the three account-feature toggles are single-select/individual-boolean rather than true multi-select (no array-value support in this schema); employer address is one line, not a street/city/state/ZIP group; `investmentExperience` is one overall level rather than the reference brokerage's per-product breakdown. | User asked to finish incorporating the remaining brokerage fields after the first pass (Section 1 + regulatory questions) and deploy. Followed the same pattern established in the prior row (generic `field_definition`-driven catalogue, enum/boolean allowlist checks, kept in parity across Java/Worker) rather than reopening architecture decisions. | Active — implemented (33 Java test classes, 30 Worker tests, 78 React tests) and deployed |
| 2026-08-18 | UI polish pass on the personal-information form: (a) the form panel is now a responsive two-column text-box grid (one column below 560px), with group headers/conditional blocks/actions/errors spanning both columns; (b) any controlled-selection field with 5 or fewer options renders as a radio group instead of a `<select>` (one click versus a dropdown's two), with `dateOfBirth` already using a native `<input type="date">` picker; (c) fixed a rendering bug where the light-theme page background could show around/behind the wizard's dark `<main>` (light-theme `:root` background peeking through) - now `body:has(.wizard-dark)` paints the whole page black, plus a global `box-sizing: border-box` reset and `overflow-x: hidden` on body to close off the likely cause (grid/content overflow). | User reported the personal-information form should be two responsive columns of text boxes, asked for radio buttons instead of dropdowns wherever there are 5 or fewer options (fewer clicks), a native date picker for DOB, and that the page background should be fully black instead of showing white around/behind the dark panel. | Active — implemented and tested (81 React tests); Worker/Java untouched (frontend-only change) |
| 2026-08-18 | Fixed a real layout bug in the just-added radio groups: `.wizard-radio-group`'s `flex-direction: column` let each `<label>` stretch to the full grid-column width (flex default `align-items: stretch`), separating each radio input from its text by the leftover stretched space. Replaced with `display: grid; grid-template-columns: repeat(2, max-content)` (columns sized to content, not stretched) shared by both `.wizard-radio-group` and `.wizard-yesno`, so a 4-option group reads as 2x2, a 3-option group as 2-then-1, and every Yes/No group matches the same alignment - applied uniformly rather than per-field. | User's screenshot showed radio dots and their labels far apart with inconsistent spacing; asked for a 2x2-style grouping, left alignment, and the same treatment applied to every radio group on the page for visual symmetry. | Active — implemented and tested (81 React tests) |
| 2026-08-18 | Iterated the radio-group layout twice more after further screenshots showed the fixed `max-content` columns overlapping (a label's text was wider than the space actually available) and then the follow-up equal-`1fr`-column fix leaving large dead space after short labels. Settled on `display: flex; flex-wrap: wrap` - each option sits at its own content width and wraps to a new line only when the row runs out of room, which is the only one of the three approaches that's both tight and never overlaps. Then reversed course entirely per a later explicit request: **all** radio buttons and Yes/No pairs became `<select>` dropdowns again, removing the now-dead radio/Yes-No CSS. | Each layout attempt was verified against a real screenshot rather than assumed correct; the final dropdown-only request explicitly superseded the "≤5 options = radio" rule from the two rows above. | Active — implemented and tested (81 React tests) |
| 2026-08-18 | Restyled the guided-assistant panel to match the VS Code/Claude Code chat look: hairline-separated messages instead of colored bubbles (user messages green-left-bordered with room held open on the right; assistant replies purple-right-bordered with room held open on the left), and the composer changed from separate square buttons to one bordered container with the textarea on top and a slim icon toolbar (mic, send) along its bottom edge. Also doubled the chat log's height (360px to a 360-720px range). | User asked for the chat window to look like the VS Code chat window and for more open vertical space for messages, with a specific left/right alignment and border-color scheme per role. | Active — implemented and tested (82 React tests) |
| 2026-08-18 | Expanded realtime voice from 8 supported fields to the full ~54-field catalogue (mirrors `PersonalInformationPage.tsx`'s `FIELD_LABEL`, duplicated rather than shared per this repo's existing parallel-constant pattern), and added explicit instruction-level normalization rules: split a spoken full address into its separate street/city/state/ZIP fields rather than one blob; normalize enum-typed fields (marital status, citizenship, employment status, income ranges, etc.) to their exact internal codes (generated into the prompt from the same `enumFieldValues.ts` allowlist the server already validates against, not a hand-duplicated list); normalize Yes/No fields to exactly `"true"`/`"false"`. | User noticed voice only handled a handful of fields and that a full spoken address only filled one field instead of being split. | Active — implemented and tested (30 Worker tests, 81 React tests) |
| 2026-08-18 | Removed the multi-stage "stage X of 21" heading and percentage progress bar from the personal-information screen, renamed its Continue button to Submit, and replaced the old "later wizard screens are not built yet" placeholder in `OnboardingWizard.tsx` with a direct, unconditional render of the personal-information screen. On submit, instead of navigating away, a dismissible modal now lists demo "background checks" (Identity verification, Address validation, Regulatory & watchlist screening, Account setup) with copy telling the user they can close it and will be told once processing finishes - a client-side demo affordance, not a real async check pipeline. Added a demo hint to the assistant's welcome chat message with a concrete short-form-date example (`9/14/1981`) showing voice/chat input gets normalized correctly. | User said this demo only has one stage/one form, so the 21-step progress framing no longer fit; wanted a submit-time acknowledgment instead of a screen transition into an unbuilt placeholder. | Active — implemented and tested (82 React tests) |
| 2026-08-18 | Reintroduced multiple steps within that same single activity-3 screen (not a reversal of the row above - still one backend activity/one `Submit` at the end, just presented as 3 UI steps with Back/Next): Step 1 = Personal, Address, Marital status & citizenship (unchanged); Step 2 = Regulatory disclosures (renamed from "Regulatory & affiliations" - the fields are disclosure questions, not affiliations per se) + Employment & finances; Step 3 = Investment profile (renamed from "Investing objectives" - covers objective/risk/experience/time-horizon together, not just the objective field) + Trusted contact + Account features + Delivery & tax certifications. `Submit` only appears on step 3; `Save draft` remains available on every step. Replaced the old percentage progress bar with a plain "Step X of 3" text indicator (no bar), consistent with the earlier decision to drop percentage-based progress framing. | User asked for the 9 field groups to be split into a 3-step wizard along specific boundaries (Regulatory & affiliations as step 2, Investing objectives as step 3), and for both of those section names to be reworded to better match what their fields actually ask. | Active — implemented and tested (84 React tests) |
| 2026-08-19 | Added a site-wide login gate in front of the entire Cloudflare Worker (this is the only live deployment; the Java backend isn't deployed): a single shared `admin`/`admin` credential (both stored as Worker secrets, override-able without a code change) plus a real Cloudflare Turnstile CAPTCHA, required before **any** page or API on the origin is reachable - including static assets (the React JS/CSS bundle itself), the upload/download API and share-link download route, and the onboarding API. Implemented as `wrangler.jsonc`'s `assets.run_worker_first: true` (was a `/api/*`+`/downloads/*` pattern array) so the Worker's own `fetch` handler runs first for literally every request and decides whether to call `env.ASSETS.fetch` at all; an unauthenticated page/asset request gets a small standalone, non-React, black/green-themed login HTML page (`loginPage.ts`) instead, and an unauthenticated API/download request gets a 401 JSON error. Sessions are a stateless HMAC-signed cookie (`${issuedAtMs}.${hmacHex}`, 12h TTL, `auth.ts`) - no session-store table needed. The Turnstile widget itself is provisioned via Cloudflare's API rather than created by hand in the dashboard (`scripts/provision-turnstile.mjs`: finds-or-creates a widget named `<worker-name>-login` scoped to the Worker's actual `*.workers.dev` domain, then rotates its secret every provisioning run to fetch a usable value, since the list/get endpoints never return it) - matching this repo's existing "provision idempotently via the Cloudflare API in `launch.mjs`, not manual dashboard steps" pattern for R2/D1. Local dev/tests get their own fixed, non-production values via a new `.dev.vars` file (including Cloudflare's official "always passes" Turnstile test keys), so `vitest-pool-workers` runs offline/deterministically rather than hitting the real siteverify endpoint; all pre-existing Worker tests were updated to authenticate via a shared `authedFetch` test helper that mints a session cookie directly (bypassing the login/CAPTCHA flow, which has its own dedicated `loginGate.test.ts`). | User explicitly asked for a basic username/password gate (admin/admin, "for now"), a CAPTCHA to prove a human is logging in, and for **no** browser access to any page or API - explicitly including upload/download - without it. When asked which CAPTCHA, the user confirmed Cloudflare Turnstile (over a weaker self-hosted challenge) after a clarifying detour distinguishing it from AWS Cognito; then explicitly asked that the Turnstile widget itself be created via infra/automation rather than by hand in the dashboard, which is what `provision-turnstile.mjs` does. One accepted product-level side effect, not silently carved around: capture-link URLs (meant to be opened on an applicant's own phone) are now also behind this same admin login, same as everything else, since the user's instruction was a blanket "even upload and download aspects." | Active — implemented and tested (46 Worker tests, including 16 new: `auth.test.ts` + `loginGate.test.ts`); deployed and verified live via curl (root path returns the login HTML with the real Turnstile sitekey embedded, all API/download/static-asset paths return 401 or the login page pre-auth, and a wrong/fake CAPTCHA response is genuinely rejected by live Turnstile verification) |
| 2026-08-19 | Fixed a real bug in `provision-turnstile.mjs` found on the first redeploy after shipping it: it rotated the widget secret on *every* run, but Turnstile locks out rotation for 2 hours afterwards, so the second deploy failed outright ("A secret rotation is already in progress"). Rotation is the only way to read an existing widget's secret (list/get never return it), so the fix is: reuse a stored `TURNSTILE_SECRET_KEY` from `.env` when present, only rotate when there isn't one, and if that rotation is locked out, warn and leave the secret already set on the Worker in place rather than failing the deploy. Also now persists the secret to `.env` (previously only the site key was), which is what makes the reuse path work at all. | Deliberately chose the graceful-degradation fix over deleting and recreating the widget, which would have worked immediately but is a destructive action on a shared Cloudflare account resource for what is a self-inflicted, recoverable scripting problem. | Active — verified by a successful redeploy through the previously-failing path |
| 2026-08-19 | Voice UX additions: (a) a mute button (visible only during a live session) plus a **spacebar** toggle, both muting the outgoing microphone track only (`track.enabled = false` via a new `setMuted` on the session handle) so the connection stays open and the assistant's replies remain audible; (b) every voice lifecycle/mute event is now narrated into the chat log, naming which control was used ("Microphone muted (spacebar)" vs "(mute button)"), alongside new session-started/session-ended messages; (c) a first-visit modal telling the user to try voice instead of typing; (d) the guided assistant restyled from the VS-Code hairline look into actual chat-bot speech bubbles (filled, rounded, bot left/purple + user right/green, with the corner nearest each speaker squared off); (e) the plain "Step X of 3" text replaced with a 3-segment titled progress bar that keeps completed segments filled. | User asked for a mute button, a key to toggle speaking, all of it surfaced in the logging messages, an intro modal pitching the voice option, a chat-bot-looking assistant, and a titled 3-step progress bar. Two substitutions were flagged and confirmed with the user rather than assumed: the literal **Fn** key they asked for cannot be captured by browser JS at all (it's a hardware modifier that fires no key event), so spacebar was chosen as the standard push-to-talk convention; and "mute" was confirmed to mean the microphone rather than the assistant's voice output. The spacebar handler deliberately ignores keystrokes originating in inputs/textareas/selects/contenteditable, where space must remain a space. | Active — implemented and tested (89 React tests, incl. new mute-button/spacebar/typing-exemption/modal/progress-bar coverage); deployed |
| 2026-08-19 | **Restructured the repository to the ownership boundaries in `code standards review.md`**: `backend/{java-service,edge-worker,contracts}`, `frontend/` (was `react/`), `infrastructure/` (was `infra/`), and a `docs/{requirements,architecture,adr,research}` taxonomy, with a root `Makefile` as the single task runner. The Worker runtime moved out of the infrastructure boundary entirely — `infra/cloudflare/src/` became `backend/edge-worker/`, while `infrastructure/cloudflare/` kept only Wrangler config, migrations, provisioning scripts, and deploy tooling. Worker internals adopted the responsibility-based module vocabulary already mandated for the Java service (`web`/`domain`/`repository`/`service`/`assistant`/`validation`/`workflow`), mirroring the Java reference implementation rather than inventing a second shape. | The user objected that `assistant.ts` — guided-assistant business logic — lived under `infra/`, then supplied a principal-engineer review and asked for the repository to meet that standard. Every claim in the review was verified before planning against it. The rename also resolves a contradiction in this file: line 50 has always mandated a "sibling `infrastructure` area" while the directory was actually `infra/`. Two P0 findings were worse than the review stated: the Spring entry point was `com.falcon.upload.UploadDemoApplication` (the onboarding POC booting from the file-transfer demo's package, needing a `scanBasePackages` override to escape it), and `src/index.ts` interleaved onboarding with file-transfer code, violating `REQUIREMENTS.md:56`. | Active — pure refactor; the 81 Java / 46 Worker / 89 React tests were the safety net and stayed green throughout |
| 2026-08-19 | **Declared the Cloudflare Worker the canonical production runtime for the onboarding API, and the Java service an explicitly labelled reference implementation**, governed by a versioned contract and an automated parity suite in `backend/contracts/`. | The review named ungoverned duplicate business logic across the two runtimes its "most important open decision", warning the implementations will drift. Chose the Worker because it reflects deployed reality — Workers cannot run a JVM. Rejected the alternative (Java canonical, Worker as a thin proxy) because it needs JVM hosting, which is an infrastructure change rather than a reorganisation. Parity is now enforced by tests instead of by discipline. | Active — supersedes the informal "kept in parity across both backends" framing in the 2026-08-18 rows above, which relied on manual discipline |
| 2026-08-19 | **Superseded the "duplicate constants rather than share" pattern** for the onboarding field catalogue. The 54-key field list, previously triplicated across `assistant.ts` (`FIELD_KEYS`), `enumFieldValues.ts`, and `PersonalInformationPage.tsx` (`FIELD_LABEL`), now has a single TypeScript source in `backend/contracts/`, consumed by both the frontend and the edge worker. | The earlier rows recorded duplication as a deliberate choice matching "this repo's existing parallel-constant pattern". That reasoning does not survive the catalogue reaching 54 keys across three files: it became a drift hazard, which is precisely the risk the review flagged. The Java service keeps its own copy — cross-language duplication is unavoidable, and is exactly what the new parity suite exists to police. | Active — supersedes the constant-duplication rationale in the 2026-08-18 and 2026-08-19 assistant rows |
| 2026-08-19 | Confirmed (rather than changed) that the guided assistant already understands every field on all three steps: the typed/pasted-text extraction path builds its JSON schema dynamically from the `field_definition` table for activity 3, and voice's `FIELD_KEYS` list was verified programmatically to match the React app's `FIELD_LABEL` map exactly - 54 fields, zero missing, zero extra. | User asked for the assistant to understand all fields on all forms; checked before writing code rather than assuming work was needed, and no change turned out to be required. | Active — verified, no code change |

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

Implemented identically (same paths/methods/request/response shapes) in **both** the Java backend (`OnboardingController`/`CaptureController`, local/container dev) and the Cloudflare Worker (`infra/cloudflare/src/onboarding/router.ts`, what the live deploy runs) unless noted otherwise — the React client just calls relative `/api/...` paths, so it works unmodified against either.

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
| `POST /api/onboarding/assistant/realtime-session` | **Worker only.** Mints a short-lived OpenAI Realtime API ephemeral client secret for live voice; 503 if `OPENAI_API_KEY` isn't configured. | Implemented (Worker only — no Java equivalent; voice was always React+Worker-scoped) |
| `GET /api/markets/indicators` | Return normalized fixture/delayed indicators. | Planned |
| `POST /api/assistant/messages` | Return mock onboarding guidance (server-side assistant module). | Superseded by the Realtime voice session above for the one screen that needed it; not built as a separate endpoint |

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

- A paid ChatGPT subscription does not fund API calls. ChatGPT and OpenAI API billing are separate.
- **First live AI integration (2026-08-18):** the personal-information screen's voice control is a live OpenAI **Realtime API** session over WebRTC (`infra/cloudflare/src/onboarding/assistant.ts` mints an ephemeral client secret via `POST /api/onboarding/assistant/realtime-session`; `react/src/onboarding/realtimeVoice.ts` opens the WebRTC connection directly from the browser to OpenAI using only that ephemeral secret). The real `OPENAI_API_KEY` never leaves the Worker - it's a Worker secret (`wrangler secret put`, never in `wrangler.jsonc`), provisioned from the root `.env`'s `OPENAPI_KEY` value by `scripts/provision-openai-secret.mjs` (a no-op, safe-503 if absent). The interaction is voice-native end to end: the model calls `propose_field_value`, asks out loud whether to use it, and only calls `confirm_field_value` after a verbal yes - the client only ever applies a value on `confirm_field_value`, and only if that field was actually proposed first (a stray/hallucinated confirm is silently ignored, not trusted). No button click is needed in the voice path; the model's spoken audio is played back via a hidden, explicitly-`.play()`ed `<audio>` element, and its transcript is streamed into the chat log live as it's spoken (`response.output_audio_transcript.delta`/`.done`, keyed by `item_id`), so the user can listen and read along simultaneously rather than seeing text only after the model finishes speaking. Scope stays deliberately narrow (this one field-proposal flow, no general chat, no financial/legal advice). Sessions hard-close after 3 minutes and have an explicit "End voice session" control, to bound the per-minute billing this incurs. Unsupported browsers (no WebRTC/mic) and denied mic permission both fall back to the existing fully-functional text-chat path.
- **Second live AI integration (2026-08-18):** the chat composer's typed/pasted text is sent to `POST /api/onboarding/assistant/extract-fields` (Worker-only, same secret, same 503-if-unset pattern), a narrow structured-extraction call (`gpt-4o-mini`) that proposes values for any of activity 3's fields it can identify in the text - never applies them directly, using the same `Use this`-confirmation UI as voice. The prompt/schema is built dynamically from the `field_definition` catalogue, not a hardcoded field list. This is deliberately extraction-only: the assistant's reply is a templated acknowledgment of the extraction result, not a free-form conversational response - a real general-chat assistant remains out of scope.
- Everything else AI/voice-related (general conversational guidance, other wizard screens, text-to-speech) remains `mock`-only; the Realtime voice session and the text/paste extraction call above are the only two live calls in the codebase.

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
| `AI_MODE` | `mock` | Live provider disabled by default for general chat/other screens. |
| `OPENAI_API_KEY` | Live since 2026-08-18 | Cloudflare Worker secret (`wrangler secret put`, sourced from root `.env`'s `OPENAPI_KEY`), narrow scope: personal-information Realtime-API voice session only (propose/confirm field values). Only an ephemeral, minutes-scale client secret ever reaches the browser — never this key itself. Never in `wrangler.jsonc`/committed files/browser code. |
| `CAPTURE_LINK_TTL` | Short bounded duration | Environment-configurable. |
| `EMAIL_DELIVERY_MODE` | `copy-link` locally | Provider credentials remain server-side. |

### Cloud portability

- **Cloudflare (what's actually deployed):** one Worker (`aom-demo`) hosts the React static assets and runs the onboarding API for activities 1–4/identity-capture natively in TypeScript against D1 (`infra/cloudflare/src/onboarding/`) — not a proxy to a separately-hosted Java service. The Java backend remains the reference implementation for local/container dev; a future adapter that instead calls a separately-hosted Java service (for activities 5–21, before/if they're ported to Workers) would use a Worker only for edge/static/API routing, with R2/D1 bound only where used.
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

1. ~~An approved separate OpenAI API billing account and spend limit for live AI/voice.~~ Done 2026-08-18 - narrow-scope voice field-extraction only (see "AI and voice" above); general chat, other screens, and text-to-speech remain mock.
2. A Twelve Data plan/key and confirmation of permitted delayed/real-time client display for the selected symbols.
3. Email or SMS provider, sender domain, and consent model if capture links will be delivered outside the local UI.
4. Dedicated demo storage/database resources and deployment permissions.
5. Optional production/demo hostname and DNS ownership when deployed publicly.
