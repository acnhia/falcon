# Falcon — Brokerage Account-Onboarding POC

A demonstration-only brokerage-account onboarding experience: a React frontend, a Java 21 /
Spring Boot backend, and a resumable, server-persisted workflow engine. Built to show engineering
discipline (TDD, provider-neutral adapters, cloud-portable deployment) — **not** a real brokerage
service. See [`context.md`](context.md) and [`docs/brokerage-onboarding/`](docs/brokerage-onboarding)
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
  through 8 wizard screens (see [`05-wizard-data-and-services.md`](docs/brokerage-onboarding/05-wizard-data-and-services.md)).
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
| Wizard screens 3–8, market ticker, server-side assistant module | ⏳ Not started — see the decision log in `context.md` |

Backend: 74 tests passing (`mvn test`, via the Dockerized Maven run below). Frontend: 50 tests
passing (`npm test`), plus a clean `tsc --noEmit`, `npm run build`, and `oxlint`.

## Running it locally

This repo also contains an earlier, separate multipart-file-transfer learning demo
(`backend/src/main/java/com/falcon/upload`, `react/src/upload`) — unrelated to onboarding, kept
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
backend/   Spring Boot 3 / Java 21
           src/main/java/com/falcon/onboarding/  the onboarding POC (domain, workflow, task, repository/jdbc, web)
           src/main/java/com/falcon/upload/       the unrelated file-transfer demo
react/     Vite + React
           src/onboarding/   OnboardingWizard, WelcomePage, PersonalInformationPage, DocumentCapturePage, mockAssistant
           src/upload/       the unrelated file-transfer demo
infra/     Cloud deployment adapters (currently: Cloudflare Workers/R2/D1 for the file-transfer demo — see infra/README.md)
docs/brokerage-onboarding/   requirements, architecture, and the 21-activity/8-screen wizard design
context.md   durable decision log and implementation-status record for the onboarding POC
```
