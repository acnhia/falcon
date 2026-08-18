# Brokerage onboarding POC — wizard, data, and service design

## Boundary

This is a synthetic demonstration, not a production account-opening specification. A real broker-dealer needs compliance, legal, privacy, tax, security, accessibility, and operations approval for each field, check, disclosure, retention rule, and decision. The POC does not collect real tax IDs, government-document numbers, bank-account numbers, biometric data, credit reports, or brokerage credentials.

## Workflow activities versus wizard screens

There are **21 workflow activities**, but only **8 user-facing wizard screens**. Background tasks run after bounded user submissions and display an honest status; they never make users wait on a hidden, unbounded request.

| Wizard screen | User-entered data | Workflow activities covered |
| --- | --- | --- |
| 1. Welcome and consent | demo acknowledgement; privacy/disclosure acknowledgement | 1 Welcome, 2 create/resume application |
| 2. Personal information | synthetic preferred/legal-name components, date-of-birth format, email-format contact, phone-format contact, residential country | 3 personal information, 4 mock age/identity pre-check |
| 3. Address and tax residency | residential/mailing address; residency/citizenship/tax-residency selections | 5 address, 6 mock normalization, 7 citizenship/tax-profile rules |
| 4. Employment and financial profile | employment status, occupation/industry, income range, liquid/total net-worth ranges, expense range | 8 employment/income, 9 financial profile, 10 completeness/eligibility mock check |
| 5. Objectives and account features | objectives, horizon, liquidity/risk selections, account type, cash/margin, options interest | 11 objectives, 12 account configuration, 13 mock feature eligibility |
| 6. Contacts, disclosures, and agreements | trusted-contact/beneficiary opt-ins; disclosure and agreement acknowledgements | 14 contacts, 15 disclosures, 16 agreements |
| 7. Identity and funding preference | capture-link request; funding-method preference and range | 17 identity capture request, 18 front/back capture and mock validation, 19 funding preference/mock external-account verification |
| 8. Review and submit | corrections and submission confirmation | 20 mock screening/review, 21 submit and mock decision/next steps |

The landing page presents screen 2 as **Personal information — stage 2 of 21**. Each wizard screen displays both its screen number (for navigation) and the underlying activity progress (for transparency).

## The 21 activity definitions

| # | Activity | Type | Required input / result | Retry and visibility |
| --- | --- | --- | --- | --- |
| 1 | Acknowledge demo/consent | User | required acknowledgement | Editable before submit. |
| 2 | Create or resume application | System | opaque reference/current checkpoint | Idempotent; resumes earliest incomplete required activity. |
| 3 | Collect personal information | User | required synthetic contact/identity-format fields | Save draft and continue. |
| 4 | Mock age/identity pre-check | Backend mock | `PASS`, `NEEDS_INPUT`, or `REVIEW` | Status visible; rerun if source fields change. |
| 5 | Collect address/residency | User | residence/mailing/tax-residency selections | Save draft and continue. |
| 6 | Normalize address | Backend mock | normalized-status/source | Retryable; user can correct source fields. |
| 7 | Apply tax-profile rules | Backend mock | required tax-profile selections | Reruns on residency/citizenship change. |
| 8 | Collect employment/income | User | conditional employment and income-range fields | Save draft and continue. |
| 9 | Collect financial profile | User | range-based profile fields | Save draft and continue. |
| 10 | Evaluate profile completeness | Backend mock | complete/missing-field result | Immediate bounded response. |
| 11 | Collect objectives | User | objective, horizon, liquidity, risk selections | Save draft and continue. |
| 12 | Select account features | User | account type/feature selections | Conditional validation. |
| 13 | Mock feature eligibility | Backend mock | eligible/needs-review result | Reruns when configuration changes. |
| 14 | Contacts and beneficiaries | User | optional/conditional details and opt-ins | Skippable only when policy permits. |
| 15 | Record disclosures | User | required versioned acknowledgements | Immutable acknowledgement record. |
| 16 | Record agreements | User | synthetic e-sign acknowledgement | Immutable version/hash record. |
| 17 | Issue identity capture link | Backend | opaque, expiring token | Reissue invalidates prior active token. |
| 18 | Capture and validate documents | User + backend mock | synthetic front/back image; mock result | Retry capture safely; token single-use after success. |
| 19 | Funding preference/verification | User + backend mock | preference/range, mock verification | No real banking data in POC. |
| 20 | Mock screening and final review | Backend mock | screening/review status | Background-style status; retryable mock adapter. |
| 21 | Submit and render next steps | User + backend mock | submit acknowledgement and mock outcome | Idempotent submission; terminal state shown. |

## Resume and retry

- Every wizard submission creates an idempotent `workflow_operation` tied to an application and correlation ID.
- Successful save/continue operations atomically persist changed fields, update the corresponding activity status, and return `currentWizardScreen`, `currentActivity`, `nextRequiredActivity`, and a truthful completion percentage.
- On return, the application resumes at the earliest required activity that is neither `COMPLETED` nor `NOT_APPLICABLE`; the browser is never the source of truth for progress.
- Changing an upstream field marks dependent mock checks and later activities `STALE`, explains why, and requires confirmation/rerun rather than silently reusing old outputs.
- Transient mock/provider failure becomes `RETRYABLE`; a retry reuses the same idempotency key. Terminal failures show a safe status and do not reveal sensitive details.

## Normalized relational model

| Entity | Key columns | Purpose |
| --- | --- | --- |
| `onboarding_application` | `id`, `public_reference`, `overall_status`, `current_activity`, `wizard_screen`, `schema_version`, timestamps, `version` | Aggregate/root and resume pointer. |
| `onboarding_activity` | `id`, `application_id`, `activity_number`, `status`, timestamps, `blocked_reason_code`, `version` | One resumable state row for each of 21 activities. |
| `field_definition` | `id`, `activity_number`, `field_key`, `data_type`, `requirement_rule`, `sensitivity_class`, `schema_version` | Versioned field catalogue. |
| `application_field_value` | `id`, `application_id`, `field_definition_id`, encrypted `value`, `source`, `status`, confirmation/timestamps, `version` | A single user, assistant, or mock-derived field value. |
| `application_address` | `id`, `application_id`, `address_type`, encrypted components, `normalization_status` | Repeating structured address data. |
| `identity_capture_session` | `id`, `application_id`, `token_hash`, expiry/consumption/status | Opaque capability; raw token is never stored. |
| `identity_document` | `id`, `application_id`, `capture_session_id`, `side`, private `object_key`, type, size, checksum | Document metadata only; bytes stay in private storage. |
| `provider_check` | `id`, `application_id`, `check_type`, `provider_mode`, `status`, `result_code`, `correlation_id` | Mock identity, normalization, screening, and funding outputs. |
| `application_disclosure_acknowledgement` | `id`, `application_id`, code/version/timestamp | Immutable disclosure evidence. |
| `application_agreement_acceptance` | `id`, `application_id`, agreement/version/hash/timestamp | Immutable synthetic agreement acknowledgement. |
| `workflow_operation` | `id`, `application_id`, `operation_type`, `idempotency_key`, `status`, timestamps, `error_code` | Retry/idempotency boundary. |
| `application_audit_event` | `id`, `application_id`, type, activity, actor, correlation ID, timestamp, redacted metadata | Append-only, safe audit history. |

Sensitive values require encryption/key management and retention/deletion policies before production. IDs exposed to the browser are opaque; private object keys, internal IDs, secrets, raw audio, and raw provider payloads are never exposed.

## Logical service boundaries

Begin as a modular monolith behind the allowlisted `onboarding-api-worker`, not as 21 microservices.

| Module | Activities |
| --- | --- |
| `application` | create, load/resume, save drafts, completion calculation |
| `workflow` | transitions, prerequisite rules, stale dependencies, idempotency |
| `assistant` | deterministic text/voice proposal generation and explicit acceptance |
| `identity-capture` | token issuance, document capture/storage, mock validation |
| `verification` | address, eligibility, funding, screening mock adapters |
| `disclosures` | versioned disclosures and agreement acknowledgements |
| `notifications` | in-app mock delivery/status links |
| `decisioning` | deterministic mock next-step outcome; never real account decisioning |

Initial bounded tasks include `CreateApplication`, `GetResumeState`, `SaveActivityDraft`, `ContinueActivity`, `GetAssistantProposal`, `AcceptAssistantProposal`, `IssueCaptureLink`, `UploadDocument`, `RunMockCheck`, `RecordDisclosureAcknowledgement`, `SubmitApplication`, and `GetApplicationStatus`. Any real long-running external check must later use an asynchronous job/status pattern.

## Tests required before implementation

- Required, optional, conditional, and derived-field validation.
- Save/resume at every wizard screen/activity, including a partially completed application.
- Idempotent retry, concurrent-tab conflict, and upstream-field invalidation behavior.
- Assistant/voice proposals require explicit acceptance and cannot overwrite confirmed values.
- Mock adapter success, retryable failure, terminal failure, and disabled capability behavior.
- Browser/API privacy checks: no secret, raw audio, full transcript, real PII, or private object key exposure.
