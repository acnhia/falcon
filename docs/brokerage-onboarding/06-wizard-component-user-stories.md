# Brokerage onboarding POC — consolidated wizard component user stories

## Intent and boundary

The POC retains **21 internal workflow activities** for auditability, retry, and future automation, but presents **four user-facing sections**. A user is never forced through 21 pages. All values are synthetic-demo values; no real broker account is opened and every background result is visibly labelled `Mock`.

## Four-section experience

| Section | Activities | User purpose | Background status work |
| --- | --- | --- | --- |
| 1. Identity and residency | 1–7 | Establish synthetic identity and residency. | Mock age/identity pre-check, address normalization, tax-profile rules. |
| 2. Financial profile and account choices | 8–13 | Select ranges, objectives, risk, and account features. | Mock completeness and feature eligibility. |
| 3. Verification, contacts, and agreements | 14–19 | Contacts, agreements, synthetic ID capture, funding preference. | Mock document validation, screening, external-account verification. |
| 4. Review and submit | 20–21 | Correct data, review readiness, submit demo application. | Mock final review, routing, and next-step result. |

Each section has a title, activity label, truthful overall progress, editable inputs, accessible validation, a bottom status rail for background work, and `Save draft` / `Continue` controls. Returning users resume at the earliest incomplete required activity.

## Shared component stories

### UI-WIZ-001 — Resume safely

**As a demo applicant,** I can return to the earliest incomplete required activity with server-persisted values and check statuses.

- Browser-local state is never the source of truth.
- The UI does not expose internal IDs, object keys, tokens, provider payloads, or stacks.
- Progress is calculated from completed required activities.

### UI-WIZ-002 — Show background work honestly

**As a demo applicant,** I see a bottom status rail for `Mock check complete`, `In progress`, `Needs input`, `Needs review`, `Retryable`, `Stale`, and `Disabled` states.

- Every result says `Mock` or `Demo`; it never claims KYC, AML, credit, banking, sanctions, or account-opening decisions.
- Retryable status offers a safe retry/update action. Colour supplements text/icons and never conveys status alone.

### UI-WIZ-003 — Save and continue

**As a demo applicant,** I can save without advancing, or continue only after current requirements are met.

- Save and continue are idempotent and announce results accessibly.
- Continue focuses the first invalid field.
- A material upstream change marks dependent checks stale and shows that in the status rail.

## Section 1 — Identity and residency

### UI-S1-001 — Demo acknowledgement (activity 1)

**As a visitor,** I acknowledge synthetic/demo-only use before an application is created.

| Field | Requirement |
| --- | --- |
| `demoAcknowledgement` | Required |
| `privacyDisclosureAcknowledgement` | Required, versioned |

The system records acknowledgement code/version/timestamp only. The user cannot continue until both are selected.

### UI-S1-002 — Personal information (activity 3; landing workspace, stage 2 of 21)

**As a demo applicant,** I enter synthetic personal, address, and regulatory-disclosure details for the POC. This story deliberately absorbs what a strict 21-activity/8-screen split would put on a separate "address and tax residency" screen (activities 5–7) and the brokerage-inspired regulatory/affiliation questions, folded into this one screen to match how a real brokerage account-opening form actually presents them (one page, several sections) — see `context.md`'s decision log entry recording this scope choice. Screen 3 itself (a distinct wizard screen for address/tax-residency) remains unbuilt/deferred.

**No real SSN/tax-ID is collected** — a deliberate, non-negotiable exclusion, even though it is central to the real form's own gating logic (see `account_opening_fields.md`).

| Field | Requirement | Validation/source |
| --- | --- | --- |
| `legalFirstName`, `legalLastName` | Required | Text, 1–80 characters |
| `middleName` | Optional | Text |
| `suffix` | Optional | Controlled selection: `JR,SR,I,II,III,IV` |
| `preferredFirstName`, `preferredLastName` | Optional | Text; assistant may propose |
| `dateOfBirth` | Required | ISO date format; mock pre-check input |
| `email` | Required | Email format only; no delivery in POC |
| `phone` | **Required** | Phone-format value only; no call/SMS (promoted from optional to match a real form's mobile-verification requirement) |
| `residentialAddressLine1`, `residentialCity`, `residentialState`, `residentialPostalCode` | Required | US-shaped address (no PO boxes for line 1); `residentialState` is a controlled 2-letter state/territory selection |
| `residentialAddressLine2` | Optional | Apt./suite/unit |
| `residentialCountry` | Required | Controlled country selection (unchanged; still free text in this POC) |
| `hasMailingAddress` | Optional | Boolean toggle; reveals `mailingAddress*` fields below when checked |
| `mailingAddressLine1`, `mailingAddressLine2`, `mailingCity`, `mailingState`, `mailingPostalCode` | Optional | Shown only when `hasMailingAddress` is checked; no server-side conditional-required enforcement in this POC (front-end only) |
| `maritalStatus` | Required | Controlled selection: `SINGLE,MARRIED,DIVORCED,WIDOWED` |
| `citizenship` | Required | Controlled selection: `US_CITIZEN,RESIDENT_ALIEN,NON_RESIDENT_ALIEN` |
| `isBrokerDealerAffiliated` | Required | Boolean Yes/No; reveals `brokerDealerFirmName` (optional) when "true" |
| `isControlPerson` | Required | Boolean Yes/No; reveals `controlPersonCompany` (optional) when "true" |
| `isPoliticallyExposedPerson` | Required | Boolean Yes/No |
| `hasOtherBrokerageAccounts` | Optional | Boolean Yes/No |
| `employmentStatus` | Required | Controlled selection: `EMPLOYED,SELF_EMPLOYED,RETIRED,STUDENT,HOMEMAKER,UNEMPLOYED` |
| `employerName`, `occupation`, `employerAddress`, `yearsWithEmployer` | Optional | Shown only when `employmentStatus` is `EMPLOYED`/`SELF_EMPLOYED`; employer address simplified to one line (not a street/city/state/ZIP group) |
| `annualIncomeRange`, `netWorthRange`, `liquidNetWorthRange` | Required | Coarse range buckets (`UNDER_25K` … `OVER_500K`), never exact figures |
| `taxBracketRange` | Optional | Coarse selection: `LOW,MODERATE,HIGH,HIGHEST` |
| `sourceOfFunds` | Required | Controlled selection, single-select (the reference brokerage's real form allows multiple; simplified since this POC's field values are flat strings with no array/multi-select support) |
| `investmentObjective` | Required | Controlled selection: `INCOME,GROWTH,GROWTH_AND_INCOME,SPECULATION,CAPITAL_PRESERVATION` |
| `riskTolerance` | Required | Controlled selection: `CONSERVATIVE,MODERATE,AGGRESSIVE` |
| `investmentExperience` | Required | Controlled selection: `NONE,LIMITED,GOOD,EXTENSIVE` — one overall level rather than the reference brokerage's per-product (stocks/bonds/options/etc.) breakdown |
| `timeHorizon` | Required | Controlled selection: `SHORT_TERM,MEDIUM_TERM,LONG_TERM` |
| `trustedContactName`, `trustedContactPhone`, `trustedContactEmail`, `trustedContactRelationship` | Optional | Per FINRA Rule 2165, synthetic only |
| `wantsMarginAccount`, `wantsOptionsTrading`, `wantsDividendReinvestment` | Optional | Individual boolean toggles rather than a checkbox group (same array/multi-select limitation as `sourceOfFunds`) |
| `deliveryPreference` | Required | Controlled selection: `E_DELIVERY,PAPER` |
| `costBasisMethod` | Optional | Controlled selection: `FIFO,LIFO,SPECIFIC_IDENTIFICATION,AVERAGE_COST` |
| `w9Certification`, `esignatureConsent` | Required | Boolean acknowledgement checkboxes; mock/synthetic, no real tax certification or signature capture |

The dark landing workspace places the form left (grouped into Personal / Address / Mailing address / Marital status & citizenship / Regulatory & affiliations / Employment & finances / Investing objectives / Trusted contact / Account features / Delivery & tax certifications subsections), a full chat window right (persistent text composer plus a voice button — not just a suggestion trigger), and status rail below. Chat/voice proposals require explicit `Use this`; they cannot overwrite confirmed values. Typed or pasted chat text is run through a narrow-scope structured-extraction call (Worker-only; see `context.md`'s "AI and voice" section) that proposes values for any fields it can identify in the text — never auto-applies them.

This completes the fields observed/inferred in `account_opening_fields.md` (Sections 1–4), minus the excluded SSN, with the documented simplifications above (single-select instead of multi-select, one-line employer address, one overall investment-experience level).

### UI-S1-003 — Mock pre-check status (activity 4)

**As a demo applicant,** I see `Mock pre-check passed`, `Needs input`, or `Needs review` after saving personal information.

There is no additional user field. Changing date of birth invalidates the previous result and reruns the bounded mock check after save/continue.

### UI-S1-004 — Address, citizenship, and tax residency (activities 5–7)

**As a demo applicant,** I supply synthetic residence and residency selections so mock checks can run.

| Field | Requirement |
| --- | --- |
| `residentialAddressLine1`, `residentialCity`, `residentialPostalCode` | Required |
| `residentialAddressLine2` | Optional |
| `residentialRegion` | Conditional by country |
| `mailingAddressSameAsResidential` | Required boolean |
| `mailingAddress*` | Conditional when not same as residential |
| `citizenshipCountries` | Required, one or more controlled selections |
| `taxResidencyCountries` | Required, one or more controlled selections |
| `taxClassification` | Required controlled selection |

Address normalization and tax-profile rules run as mock status-rail activities. The POC captures no taxpayer ID, tax-form document, or evidence.

## Section 2 — Financial profile and account choices

### UI-S2-001 — Employment and financial ranges (activities 8–10)

**As a demo applicant,** I select coarse synthetic ranges instead of exact sensitive financial values.

| Field | Requirement |
| --- | --- |
| `employmentStatus` | Required |
| `occupationCategory`, `employerIndustry` | Conditional on employment status; category only |
| `annualIncomeRange`, `liquidNetWorthRange`, `totalNetWorthRange`, `annualExpensesRange`, `investmentExperienceRange` | Required |

No exact salary, employer identity, assets, liabilities, or account balances are requested. Mock completeness appears in the status rail.

### UI-S2-002 — Objectives and account configuration (activities 11–13)

**As a demo applicant,** I choose controlled account preferences for the demonstration.

| Field | Requirement |
| --- | --- |
| `investmentObjectives` | Required, one or more controlled selections |
| `investmentHorizon`, `liquidityNeeds`, `riskTolerance` | Required |
| `accountType`, `cashOrMarginPreference` | Required |
| `optionsInterest`, `jointAccountIntent` | Required controlled boolean/selection |

Mock feature eligibility appears in the status rail. The UI provides no investment recommendation, suitability conclusion, or real eligibility decision.

## Section 3 — Verification, contacts, and agreements

### UI-S3-001 — Contacts and beneficiaries (activity 14)

**As a demo applicant,** I may elect to enter synthetic trusted-contact or beneficiary details.

| Field | Requirement |
| --- | --- |
| `trustedContactOptIn`, `beneficiaryOptIn` | Required choices |
| `trustedContactName`, `trustedContactRelationship`, `trustedContactEmail`, `trustedContactPhone` | Conditional on opt-in; synthetic only |
| `beneficiaryName`, `beneficiaryRelationship`, `beneficiaryAllocationPercent` | Conditional on opt-in; synthetic only |

### UI-S3-002 — Disclosures and agreements (activities 15–16)

**As a demo applicant,** I acknowledge versioned mock disclosures and agreements.

| Field | Requirement |
| --- | --- |
| `disclosureAcknowledgements`, `agreementAcceptances`, `syntheticSignatureAcknowledgement` | Required, versioned acknowledgement selections |

The POC creates immutable acknowledgement records but never captures a real signature image.

### UI-S3-003 — Synthetic identity capture and funding preference (activities 17–19)

**As a demo applicant,** I request a capture link, submit synthetic front/back images, and select a funding preference.

| Field/action | Requirement |
| --- | --- |
| `captureLinkRequest` | Required action |
| `frontDocument`, `backDocument` | Required synthetic images only; stored private, metadata only |
| `fundingMethodPreference`, `initialFundingRange` | Required controlled selections |

The status rail shows mock identity validation, mock screening, and mock external-account verification. The POC never requests bank routing/account data, credentials, or real government-document data.

## Section 4 — Review and submit

### UI-S4-001 — Review and corrections (activity 20)

**As a demo applicant,** I see section-level completeness and can return to the appropriate source field for stale, blocked, or missing information.

### UI-S4-002 — Mock submission and next steps (activity 21)

**As a demo applicant,** I explicitly submit the synthetic application and receive a mock outcome.

| Field | Requirement |
| --- | --- |
| `submissionConfirmation` | Required |

Submission is idempotent and available only when required activities are complete or not applicable. Result values such as `READY_FOR_REVIEW`, `APPROVED`, `NEEDS_REVIEW`, or `DECLINED` are visibly mock POC results, never real brokerage decisions.

## Backend stories

- **BE-WIZ-001:** persist application, activity, normalized fields, checks, acknowledgements, operations, and redacted audit records independently.
- **BE-WIZ-002:** run bounded mock validation after relevant input, returning a safe status instead of a separate UI page.
- **BE-WIZ-003:** protect retries/concurrent tabs with idempotency keys, correlation IDs, optimistic versions, and stale-dependency rules.
- **BE-WIZ-004:** implement identity, address, tax, feature, funding, screening, assistant, and decision capabilities through provider-neutral mock adapters.

## Tests required before implementation

- Required, optional, and conditional field rules; save/resume and continue gating for every section.
- Status rail states: mock pass, in-progress, retryable, blocked, stale, and disabled.
- Chat/voice proposals cannot silently set or overwrite a confirmed value.
- Resume from a 20% complete application, refresh/retry with the same idempotency key, and dependent-check invalidation.
- No secrets, raw audio, transcript, token, object-key, or real PII exposure in browser/API/logs.
