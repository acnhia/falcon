# File Transfer Business Service

## Purpose

This repository began as a secure multipart file-transfer demonstration and now also contains a brokerage-account-onboarding partner POC. This document is a durable business/service handoff: it explains the intended capabilities, boundaries, architecture, and where the detailed requirements live.

It contains no credentials, real customer data, document images, capture tokens, or provider secrets.

## File-transfer service

### Business capability

Users can upload a large file in parts, track the upload, share a generated download link, and let another user download the completed object.

### Core requirements

- Multipart uploads are coordinated as explicit lifecycle sessions.
- Completed transfer metadata is persisted in a managed relational database.
- A completed upload receives an unguessable public share token and download URL; internal session IDs and storage keys are never exposed in that URL.
- The React application has upload and download experiences; the Cloudflare Worker serves API/download routes and static assets.
- During upload, the UI displays current effective transfer speed and preserves final effective speed in human-readable binary units such as KiB/s or MiB/s.
- Test uploads are restricted to 10 GiB of application-managed storage. The service reserves declared bytes before transfer, rejects over-limit transfers, and offers an explicit, prefix-scoped test-data cleanup/retry choice.
- Test storage uses a dedicated configured bucket. Cleanup never deletes unrelated bucket objects.

### Current service architecture

```text
React client
  -> Cloudflare Worker API
     -> Durable Object per upload session
     -> Durable Object storage quota coordinator
     -> R2 object storage
     -> D1 transfer metadata
  -> Share/download URL
```

### File-transfer safety rules

- Storage credentials remain server-side.
- Public URLs contain only opaque share tokens.
- Deletion is explicit, scoped, and auditable.
- The storage quota is a test-cost guardrail, not a claim about all bucket objects.

## Brokerage-account-onboarding POC

### Purpose and limitation

The onboarding capability is a synthetic partner demonstration of a modern brokerage onboarding journey. It does not open a real account, make investment recommendations, make regulatory decisions, or process real identity, tax, banking, or biometric data.

### Four user-facing sections

The backend keeps 21 auditable workflow activities, but the user sees four consolidated sections:

1. **Identity and residency** — consent, synthetic personal information, address, citizenship, and tax-residency selections.
2. **Financial profile and account choices** — employment, coarse financial ranges, objectives, risk, and account-feature preferences.
3. **Verification, contacts, and agreements** — optional synthetic contacts/beneficiaries, acknowledgements, document capture, and funding preference.
4. **Review and submit** — corrections, readiness review, and explicit synthetic submission.

Background derivations and checks are not additional pages. They are visible in an accessible status rail with truthful `Mock`, `In progress`, `Retryable`, `Blocked`, `Stale`, or `Disabled` states.

### Landing experience

The POC landing page is a dark, original fintech-style **Personal information — stage 2 of 21** workspace:

- Synthetic personal-information form on the left.
- Persistent guided chat on the right.
- Explicit voice control at the bottom of chat.
- Assistant/voice proposals stay editable and require explicit user acceptance before filling a field.
- The interface uses an original design with restrained green positive-state accents; it does not copy another company’s branding, assets, layouts, or trade dress.

### Resilience and persistence

- Applications resume from server-persisted activity/checkpoint state, not browser progress alone.
- Save, continue, and provider/check operations use idempotency keys and correlation IDs.
- Material source changes invalidate dependent derived checks and prompt the user to update or rerun them.
- The data model separates application, activity, field value, address, document, provider check, acknowledgement, agreement, workflow operation, and audit-event concerns.

### Provider and privacy boundaries

- Documents, applicant values, and market values are synthetic for the POC.
- Identity capture uses opaque, expiring, single-use tokens and private object storage.
- A mock document-validation result is visibly labelled `Mock validation`; it is not KYC, AML, fraud detection, or legal identity verification.
- Market data begins as fixtures/delayed data; real-time display requires approved licensing. Russia/MOEX remains disabled unless specifically approved.
- Assistant/voice providers are isolated behind provider-neutral boundaries. No browser receives provider secrets.
- A ChatGPT subscription is not application API funding. Any live API integration requires separately approved API billing, a server-side secret, and a spend limit.

## Implementation structure

```text
react/
  src/upload/                 File-transfer UI
  src/download/               Shared-download UI
  src/onboarding/             Brokerage onboarding UI

backend/
  src/main/java/com/falcon/onboarding/
                             Java reference onboarding service

infra/cloudflare/
  src/                        Worker, Durable Objects, D1/R2 integration
  src/onboarding/             Cloudflare Worker onboarding implementation

docs/brokerage-onboarding/    Detailed onboarding requirements
```

Cloud-neutral terms are used in business logic: tasks, actions, workers, storage, validation, and adapters. Provider-specific deployment choices stay in infrastructure modules.

## Detailed requirement documents

| Document | Contents |
| --- | --- |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Global working agreement, TDD, file-transfer rules, onboarding boundaries. |
| [context.md](context.md) | Durable project context, decisions, implementation status, and provider constraints. |
| [Onboarding overview](docs/brokerage-onboarding/00-overview.md) | POC purpose, lifecycle, high-level stories. |
| [Frontend requirements](docs/brokerage-onboarding/01-frontend.md) | Routes, UI, accessibility, capture, chat, and voice requirements. |
| [Backend requirements](docs/brokerage-onboarding/02-backend.md) | Task-worker model, APIs, validation, persistence, and safety. |
| [Deployment requirements](docs/brokerage-onboarding/03-deployment.md) | Local/demo environments, infrastructure, provider modes, deployment controls. |
| [21-step workflow](docs/brokerage-onboarding/04-onboarding-flow.md) | Original detailed lifecycle activity map and recovery behavior. |
| [Wizard data and service design](docs/brokerage-onboarding/05-wizard-data-and-services.md) | 21 activities, field model, normalized data structure, retry/resume, service boundaries. |
| [Wizard component user stories](docs/brokerage-onboarding/06-wizard-component-user-stories.md) | Consolidated four-section stories, all user-captured fields, status rail, backend stories, and tests. |

## Delivery rules

- Record new requirements in Markdown before implementation.
- Follow test-driven development: add focused failing tests before behavior changes.
- Keep mock, fixture, delayed, disabled, and live states visibly distinct.
- Never commit secrets or real PII.
- Do not enable live verification, financial, market-data, or AI capabilities merely because credentials exist; each requires explicit approval.
