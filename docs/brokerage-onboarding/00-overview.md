# Brokerage onboarding partner POC — overview

## Purpose

Demonstrate the organisation's ability to build a secure, testable, cloud-portable brokerage-account onboarding experience. This is a **demo-only** application: it uses synthetic applicants, simulated market data, and a deterministic mock identity-validation result.

## Non-goals and safety boundaries

- This POC does not open a real brokerage account, execute trades, make suitability decisions, or provide investment advice.
- Do not collect, retain, log, or transmit real customer PII, real driver licenses, biometric data, brokerage credentials, or payment data.
- The identity-validation result is visibly labelled **Mock validation**. It is not KYC, AML, fraud detection, or legal identity verification.
- Market prices are fixtures or delayed data until a provider agreement explicitly authorizes real-time display and redistribution for each market.
- AI integration begins in mock mode. A ChatGPT subscription is not application API funding; live use requires separately configured OpenAI API billing, a server-side secret, and a spend limit.

## Product areas

| Area | Responsibility |
| --- | --- |
| Onboarding | Create and show a synthetic account-onboarding application and lifecycle state. |
| Identity capture | Issue a short-lived capture link; obtain front and back synthetic driver-license images through a browser camera or file input. |
| Validation | Persist metadata and return a deterministic mock validated result after both images are stored. |
| Market ticker | Present source, timestamp, and delayed/fixture status for major global-market indicators. |
| Conversational assistance | Present provider-neutral mock chat/voice assistance without exposing credentials. |

## Lifecycle

```text
DRAFT
  -> IDENTITY_CAPTURE_REQUESTED
  -> IDENTITY_CAPTURED
  -> IDENTITY_VALIDATED
  -> READY_FOR_REVIEW
```

Invalid, expired, or already-used capture tokens do not change application state.

## Wizard and workflow shape

- The POC represents the account journey as 21 workflow activities, but presents only 8 focused user-facing wizard screens. Background derivations and checks appear as clear status/retry states rather than unnecessary screens.
- The landing route `/` opens the dark **Personal information — stage 2 of 21** workspace. It includes a synthetic form, guided mock chat, and explicit mock voice control.
- A user can leave and return. The server persists activity state and resumes at the earliest incomplete required activity; browser-local state is not the source of truth.
- The detailed screen/activity map, fields, normalized data model, retry behavior, and logical services are specified in [wizard, data, and service design](05-wizard-data-and-services.md).

## User stories

### ONB-001 — Start a synthetic onboarding application

**As a demo user,** I want to create a synthetic account-onboarding application so that I can see the onboarding journey.

**Acceptance criteria**

- The application creates a new `DRAFT` record with an opaque public reference.
- The UI shows the current state and never requests real PII.
- A new application can proceed to identity-capture request.

### ONB-002 — Request identity capture

**As a demo user,** I want an identity-document capture link so that I can complete the document step on a camera-capable device.

**Acceptance criteria**

- The application transitions to `IDENTITY_CAPTURE_REQUESTED`.
- The returned URL contains an opaque token only, never internal IDs or PII.
- The token expiry and single-use status are represented in the backend.

### ONB-003 — Complete identity capture

**As a demo user,** I want to capture front and back images of a synthetic driver license so that the mock validation can run.

**Acceptance criteria**

- Both sides are required before submission.
- Capture is mobile-friendly and supports camera capture or file selection for development.
- The user can preview and retake either side before upload.

### ONB-004 — Receive a mock validation result

**As a demo user,** I want to see a validation outcome so that the onboarding journey reaches a review-ready state.

**Acceptance criteria**

- After both accepted images are stored, the mock validator returns `VALIDATED` deterministically.
- The application transitions through `IDENTITY_CAPTURED` to `IDENTITY_VALIDATED` and `READY_FOR_REVIEW`.
- The UI clearly says the outcome is mock validation.

### MKT-001 — See global market context

**As a demo visitor,** I want a market ticker bar so that I can see the app’s market-data integration capability.

**Acceptance criteria**

- The ticker supports Dow Jones, Nasdaq, Germany, China, South Korea, Japan, France, India, Brazil, and Russia/MOEX.
- Every value includes source, as-of timestamp, and delay/fixture label.
- Russia/MOEX is disabled by configuration until compliance and data-entitlement approval.

### AI-001 — Use guided demo assistance

**As a demo user,** I want conversational guidance during onboarding so that I can understand the flow.

**Acceptance criteria**

- The initial implementation uses mock responses and clearly states that it is a demonstration.
- A provider-neutral backend interface supports future text and voice adapters.
- No provider secret is placed in the browser or source control.

## Architecture principles

- Keep React presentation and Java/Spring business rules separate.
- Model external dependencies (storage, market data, AI, validation, delivery) as interfaces with replaceable adapters.
- Use typed configuration and environment/secret injection; do not commit secrets.
- Write a failing automated test before each behavior change, then implement the smallest passing change.
- Keep cloud-specific deployment configuration in infrastructure folders, not business logic.

## Definition of done

- Each user story has automated normal-path and failure-path coverage.
- The full local POC runs with mock dependencies and no secrets.
- Logs are structured and do not include document content, capture tokens, or PII.
- Documentation explains local execution, mock boundaries, and how live providers would be enabled safely.
