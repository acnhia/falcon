# Brokerage onboarding partner POC — 21-step onboarding flow

## Purpose and safety boundary

This is the detailed flow for the **synthetic, mock-only** partner POC. It demonstrates an onboarding experience without collecting real personal information, making real identity decisions, or opening a brokerage account.

- All applicant values and document images are synthetic.
- `VALIDATED` always means **Mock validation**, not KYC, AML, fraud, or legal identity verification.
- No trading, account approval, funding, or investment recommendation is performed.
- The flow uses a short-lived browser capture link for a camera-capable mobile device.

## How this flow appears in the UI

The numbered rows below are workflow activities, not a mandate for 21 screens. The initial wizard consolidates them into 8 screens: welcome/consent; personal information; address/tax residency; employment/financial profile; objectives/account features; contacts/disclosures/agreements; identity/funding; and review/submit. Background checks render a truthful status and retry path. The authoritative screen-to-activity and field mapping is in [wizard, data, and service design](05-wizard-data-and-services.md).

The updated POC interaction requirement consolidates this further into four user-facing sections while retaining all 21 activities: Identity and residency; Financial profile and account choices; Verification, contacts, and agreements; Review and submit. The canonical component-level field and status stories are in [wizard component user stories](06-wizard-component-user-stories.md).

## Lifecycle

```text
No application -> DRAFT -> IDENTITY_CAPTURE_REQUESTED -> IDENTITY_CAPTURED
               -> IDENTITY_VALIDATED -> READY_FOR_REVIEW
```

Invalid, expired, or used capture tokens never change the application state.

## Detailed steps

| # | Stage | User experience | System and state action | Boundary | Required test |
| ---: | --- | --- | --- | --- | --- |
| 1 | Enter POC | Opens the demo landing page. | Renders mock disclaimer, health state, and fixture/delayed market ticker. | No PII requested. | Accessibility, source/timestamp, disabled-market state. |
| 2 | Review disclosure | Reads synthetic/demo-only notice. | Explains no real account or identity validation occurs. | Never imply regulatory approval. | Disclosure shown before onboarding. |
| 3 | Start application | Selects **Start demo onboarding**. | Creates `DRAFT` application and opaque public reference. | No name, tax ID, address, or real profile. | Creation and no-PII response/log assertions. |
| 4 | View dashboard | Views current application. | Returns safe state DTO showing `DRAFT`. | Never expose database IDs. | Generic unknown-reference behavior. |
| 5 | Market context | Views global ticker. | Returns normalized fixture/delayed indicators. | MOEX disabled unless approved configuration enables it. | Source/timestamp/status labels. |
| 6 | Mock assistant | Optionally asks onboarding question. | Returns generic, non-advisory mock guidance. | No provider key or sensitive input in client. | Disclaimer and mock adapter behavior. |
| 7 | Request capture | Chooses **Capture synthetic driver license**. | Creates hashed, expiring, one-time capture token; state becomes `IDENTITY_CAPTURE_REQUESTED`. | URL has opaque token only. | Valid transition, entropy/hash, idempotency. |
| 8 | Receive link | Copies capture URL. | Builds link from trusted `PUBLIC_BASE_URL`; shows expiry. | Local mode does not send email/SMS. | No internal ID in URL; trusted-host construction. |
| 9 | Open capture page | Opens `/capture/:token`. | Validates token and returns capture-step status. | Invalid/expired/used tokens receive identical generic response. | Enumeration resistance and safe error UI. |
| 10 | Read instructions | Sees front/back, synthetic-only guidance. | Renders mobile capture UI. | No camera permission yet. | No automatic camera request; clear labels. |
| 11 | Start front capture | Selects **Capture front**. | Browser requests camera permission after user action. | Camera remains local until confirmed upload. | Permission granted/denied tests. |
| 12 | Capture front | Takes/selects synthetic front image. | Shows local preview and basic client validation. | Do not use local storage or image analytics. | Preview and type/size validation. |
| 13 | Retake/confirm front | Retakes or confirms image. | Retake replaces front only; confirm permits controlled upload. | No storage credentials in browser. | No upload before confirm; progress/error path. |
| 14 | Store front | Submits front image. | Validates MIME, decoded image, bytes/dimensions; generates opaque private key; stores metadata. | Key excludes PII/token; no public URL. | Malformed/oversized rejection and private-storage contract. |
| 15 | Start back capture | Selects **Capture back**. | Requests/reuses stream after explicit action. | Release stream after flow ends. | Stream lifecycle cleanup. |
| 16 | Capture/confirm back | Captures, previews, retakes, confirms back image. | Requires both side previews before final action. | Keep side references isolated. | Submission gating and independent retake. |
| 17 | Store back | Submits back image. | Repeats validation/private storage and persists back metadata. | Same rules as front. | Back contract and idempotent retry. |
| 18 | Complete capture | Sees both uploads complete. | Marks `IDENTITY_CAPTURED` and consumes token. | Token cannot be reused. | Both-side prerequisite, single-use, audit state. |
| 19 | Mock validation | Waits for result. | Invokes mock adapter once; no OCR or vendor call; deterministic `VALIDATED`. | No extraction, biometric work, or external transmission. | Single invocation and retry idempotency. |
| 20 | Show result | Sees result and next state. | Moves to `IDENTITY_VALIDATED`, then `READY_FOR_REVIEW`. | Must say **Mock validation completed**. | State/result and visible mock label. |
| 21 | Finish/reset | Reviews summary or starts new synthetic run. | Shows controlled reset/start-new action. | Cleanup is explicit, scoped, confirmed, and audited. | Happy-path E2E and no broad deletion. |

## Failure and recovery behavior

| Situation | Expected behavior |
| --- | --- |
| Expired/used/invalid link | Generic unavailable message; no application data; user requests new link from dashboard. |
| Camera denied | File selection for synthetic developer fixtures; clarify that no image was uploaded. |
| Invalid image | Keep session active; show safe error; allow retake/reselection. |
| Upload/storage failure | Do not transition state; show retryable error; never expose public object URL. |
| Validation retry | Return existing deterministic result; no duplicate transition/audit event. |
| Disabled provider | Show fixture/mock/disabled state; never claim live behavior. |

## Deliberately excluded production steps

The POC excludes customer authentication, consent/retention policy, real document verification, OCR, biometrics/liveness, KYC/AML/sanctions checks, manual operations, suitability, agreements, e-signature, funding, account creation, trading permissions, and real-time market-data entitlements.
