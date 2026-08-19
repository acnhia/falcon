# Falcon — Brokerage Account-Onboarding POC

A demonstration-only brokerage-account onboarding experience: a React frontend, a Java 21 /
Spring Boot backend, and a resumable, server-persisted workflow engine. Built to show engineering
discipline (TDD, provider-neutral adapters, cloud-portable deployment) — **not** a real brokerage
service. See [`context.md`](context.md) and [`docs/architecture/brokerage-onboarding/`](docs/architecture/brokerage-onboarding)
for the full requirements, decision log, and design.

## Safety boundaries

- All applicant data is synthetic. No real identity, driver license, biometric, or financial data
  is ever collected, stored, or sent to a provider.
- Identity validation is an explicit **mock** adapter — not KYC, AML, fraud detection, or legal
  identity verification.
- Chat and voice guidance on the personal-information screen are deterministic, client-side mocks:
  no real AI call, no speech-to-text, no provider credentials in the browser.

## Architecture

```
React (Vite)                    Java / Spring Boot                H2 (JDBC)
┌──────────────────┐   /api/*   ┌─────────────────────────┐      ┌───────────┐
│ OnboardingWizard  │◄──────────►│ TaskRegistry (allowlist) │◄────►│  schema.sql│
│ WelcomePage       │            │  → WizardOrchestrator    │      │  (9 tables)│
│ PersonalInfoPage  │            │  → OnboardingOrchestrator│      └───────────┘
│ DocumentCapturePage│           │  → mock validation/       │
└──────────────────┘            │    storage adapters      │
                                 └─────────────────────────┘
                                            │
                                            ▼
                                    Cloudflare R2 (private,
                                    non-public document storage)
```

- **Task-worker model**: every onboarding activity runs through an Otterobot-inspired `BaseTask` →
  one `TaskRegistry`-allowlisted task → one orchestrator method. Clients can never select an
  arbitrary class — only a fixed, named set of tasks.
- **Resumable workflow**: the onboarding journey is modeled as 21 workflow activities surfaced
  through 8 wizard screens (see [`05-wizard-data-and-services.md`](docs/architecture/brokerage-onboarding/05-wizard-data-and-services.md)).
  Server-persisted activity state — not browser state — decides where a user resumes.
- **Persistence**: plain JDBC + H2 (file-based locally, in-memory for tests) — no ORM, matching the
  rest of the codebase's raw-SQL style. Postgres-portable schema for a future managed database.

## Current status: "foundation" phase

| Area | Status |
| --- | --- |
| Activities 1–4 of 21 (consent, create/resume, personal information, mock age/identity pre-check) | ✅ Implemented and tested |
| Wizard screens 1–2 of 8 (welcome/consent, personal information) | ✅ Implemented and tested |
| Identity-capture flow (capture link → front/back document → mock validation) | ✅ Implemented and tested |
| Resumable state, idempotent retry, stale-dependency marking (date-of-birth → pre-check) | ✅ Implemented and tested |
| Remaining wizard sections (four-section model), market ticker, server-side assistant module | ⏳ Not started — see the decision log in `context.md` |

Backend: 74 tests passing (`mvn test`, via the Dockerized Maven run below). Frontend: 50 tests
passing (`npm test`), plus a clean `tsc --noEmit`, `npm run build`, and `oxlint`.

## Running it locally

This repo also contains an earlier, separate multipart-file-transfer learning demo
(`backend/java-service/src/main/java/com/falcon/upload`, `frontend/src/upload`) — unrelated to onboarding, kept
isolated by package/route, and served at `#/upload` in the same React app. Both share one
`docker-compose.yml`:

```bash
docker compose up --build
```

Then open **http://localhost:8080** for the onboarding wizard (the file-transfer demo is at
`http://localhost:8080/#/upload`). No external credentials are required for the onboarding flow —
document storage/validation run in mock/local mode.

To run just the backend's test suite (this machine has no local JDK/Maven):

```bash
docker run --rm -v "$(pwd)/backend":/workspace -w /workspace maven:3.9-eclipse-temurin-21 mvn test
```

## REST API (onboarding)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/onboarding/applications` | Create a synthetic `DRAFT` application |
| GET | `/api/onboarding/applications/{publicReference}` | Safe application status |
| GET | `/api/onboarding/applications/{publicReference}/resume` | Resume pointer, wizard screen, completion %, activity statuses, saved fields |
| PUT | `/api/onboarding/applications/{publicReference}/activities/{n}` | Save an activity's draft field values (idempotent) |
| POST | `/api/onboarding/applications/{publicReference}/activities/{n}/continue` | Validate/complete an activity (idempotent) |
| POST | `/api/onboarding/applications/{publicReference}/capture-links` | Issue a one-time identity-capture link |
| GET | `/api/onboarding/captures/{token}` | Validate a capture token, return capture-step status |
| PUT | `/api/onboarding/captures/{token}/documents/{front\|back}` | Validate/store a document image; triggers mock validation once both sides are in |

## Project structure

```
backend/
  java-service/    Spring Boot 3 / Java 21 - reference implementation, not deployed
                   src/main/java/com/falcon/FalconApplication.java   entry point
                   src/main/java/com/falcon/onboarding/              onboarding (domain, workflow,
                                                                     task, repository/jdbc, web)
                   src/main/java/com/falcon/upload/                  file-transfer demo
  edge-worker/     Cloudflare Worker - the canonical production runtime
                   src/index.ts            thin entrypoint: authenticate, then dispatch
                   src/auth/               login gate, session signing, login page
                   src/platform/           Cloudflare primitives (Durable Objects, bindings)
                   src/fileTransfer/       file-transfer demo, isolated from onboarding
                   src/onboarding/         domain, repository, service, assistant,
                                           validation, workflow, web
  contracts/       versioned API contract and cross-runtime parity tests
frontend/          Vite + React
                   src/onboarding/   the onboarding wizard
                   src/upload/       the unrelated file-transfer demo
infrastructure/
  cloudflare/      wrangler config, migrations, provisioning and deploy scripts
  local/           compose.yaml + nginx for the local stack
docs/
  requirements/  architecture/  adr/  research/
Makefile           single task runner - run `make help`
context.md         durable decision log and implementation status
REQUIREMENTS.md    global project requirements
```

Application code never lives under `infrastructure/`; that boundary holds only what deploys and
provisions. The Worker is the canonical runtime and the Java service is an explicitly labelled
reference implementation - see the decision log in `context.md`.

## Common tasks

```
make help      # list every target
make test      # Java (81) + edge worker (46) + frontend (89)
make check     # typecheck and lint everything
make up        # local Java + frontend + nginx stack
make deploy    # containerised test, build, provision and deploy
```
