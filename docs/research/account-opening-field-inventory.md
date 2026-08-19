#  Online Brokerage Account — Application Field Inventory

**Source:** a major US brokerage's live public application, institution de-identified ("General investing" / Standard account track)
**Method:** Walked the application with sample/placeholder data. All non-SSN fields were filled with fictitious values by the assistant. The SSN field itself was filled by the human user directly (the assistant does not enter SSNs into any field).
**Date captured:** 2026-08-18

## Outcome of the SSN-verification attempt

After the user entered a sample SSN and submitted the "Agree and continue" step, the application **did not unlock Section 2**. Instead, the live Social Security Administration identity-verification check ran against the submitted name/DOB/SSN combination, found no match (since the identity was fictitious), and routed straight to a hard-stop screen:

> **"We need a little more info"** — *"Give us a call at [support number redacted], Monday through Friday, 9 am – 8 pm ET to complete your application."*
> (the application routed to a hard-stop page)

This means Sections 2–4 (Employment & finances, Regulatory & affiliations, Additional details) **cannot be reached with fabricated identity data at all** — this isn't just a self-imposed limit, it's the form's own fraud/identity-verification logic blocking any non-matching SSN, regardless of who enters it. Only a real, SSA-verifiable identity would proceed past this gate. As a result, Sections 2–4 below remain unverified estimates.

## Quick summary — stage / section / field-count / types

| Stage (page) | Section | # of fields | Field type mix |
|---|---|---|---|
| 1. "Let's get to know you" | Personal & contact information | 17 (16 data fields + 1 consent checkbox) | 10 text boxes, 3 dropdowns, 2 checkboxes (mailing-address toggle + SSA consent), 1 masked text (SSN), 1 date |
| 1. "Let's get to know you" | Employment & finances *(locked/inferred)* | ~10 | 4 dropdowns, 1 multi-select, 3 conditional text, 1 number, 1 text group (address) |
| 1. "Let's get to know you" | Regulatory & affiliations *(locked/inferred)* | ~4 | 3 boolean (Yes/No) + 1 boolean, each with a conditional text follow-up |
| 1. "Let's get to know you" | Additional details *(locked/inferred)* | ~13 | 5 dropdowns, 4 text (trusted contact), 2 checkboxes, 1 checkbox group, 1 radio |

**Total observed (verified) fields: 17. Total estimated fields across the full application: ~44.**

## How the wizard is actually structured

This is **not** a traditional multi-page wizard with a step tracker. It is **one page** (screen title: *"Trade® | General investing — Let's get to know you"*) containing **four sequential accordion sections**. Each section is locked (collapsed, non-expandable) until the one above it is submitted via its own "Agree and continue" action:

| Order | Section (accordion) | Status in this walkthrough | Unlock condition |
|---|---|---|---|
| 1 | Personal & contact information | ✅ Fully captured — all fields observed directly | Open by default |
| 2 | Employment & finances | 🔒 Locked — not observed | Requires completing Section 1 (including a valid SSN) |
| 3 | Regulatory & affiliations | 🔒 Locked — not observed | Requires completing Section 2 |
| 4 | Additional details | 🔒 Locked — not observed | Requires completing Section 3 |

**Why it stopped at Section 1:** Section 1's "Agree and continue" button stays disabled until a Social Security Number is entered. Entering an SSN — real or fabricated — into a live financial institution's production form isn't something done here, so the walkthrough could not unlock Sections 2–4. Everything below for Sections 2–4 is reconstructed from standard U.S. broker-dealer new-account-opening requirements (FINRA KYC/Suitability Rules 2090/2111, Reg BI, the Trusted Contact rule 2165, and standard IRS/W-9 backup-withholding certification) — **it is a best-effort model of what those sections likely contain, not a direct observation of this specific form.** Treat Section 1 as verified and Sections 2–4 as a placeholder schema to be corrected once someone completes the flow with real information.

---

## Section 1 — Personal & contact information (CONFIRMED — directly observed)

| # | Field label | Data type | Required? | Notes / observed values |
|---|---|---|---|---|
| 1.1 | First name | Text | Required | Free text |
| 1.2 | Middle name or initial | Text | Optional | Free text |
| 1.3 | Last name | Text | Required | Free text |
| 1.4 | Suffix | Dropdown (single-select) | Optional | Observed options: **JR, SR, I, II, III, IV** (+ more below the fold) |
| 1.5 | Date of birth | Date | Required | Format `MM/DD/YYYY` |
| 1.6 | Social Security number | Text (masked, toggle-to-unmask) | Required | Has a "How we use your SSN" info link; gates the section's submit button |
| 1.7 | Email | Text (email) | Required | Standard email validation implied |
| 1.8 | Mobile number | Text (tel) | Required | Used later for SMS identity-verification code |
| 1.9 | Street address (no PO Boxes) | Text | Required | Explicitly disallows PO Boxes |
| 1.10 | Apt., suite, or unit | Text | Optional | — |
| 1.11 | City | Text | Required | — |
| 1.12 | State | Dropdown (single-select) | Required | Standard 2-letter US state/territory codes (e.g., AK, AL, AR, AZ, CA, CO…) |
| 1.13 | ZIP code | Text/number | Required | US ZIP format |
| 1.14 | Add a mailing address (toggle) | Checkbox | Optional | When checked, reveals a second, identical address block (street, apt/suite, city, state, ZIP) for a mailing address distinct from the residential address |
| 1.15 | Marital status | Dropdown (single-select) | Required | Observed options: **Single, Married, Divorced, Widowed** |
| 1.16 | Citizenship | Dropdown (single-select) | Required | Observed options: **U.S. citizen, Resident alien, Non-resident alien** |
| 1.17 | SSA SSN-verification authorization | Checkbox | Required (implied — gates submit) | "Authorization for the Social Security Administration to Disclose Your Social Security Number Verification" — one-time SSA validation consent, valid 90 days |

**Bundled consents (no separate checkbox, accepted implicitly by clicking "Agree and continue"):**
- Authorization for   Advisors to make credit/background inquiries to open and maintain the account
- Consent to receive an SMS verification code at the mobile number provided
- Authorization for the wireless carrier to disclose account/device info to   for identity verification and fraud prevention
- Consent to be contacted via automated systems at any number provided
- USA PATRIOT Act identity-verification acknowledgment (may require a driver's license or other ID document)

---

## Section 2 — Employment & finances (INFERRED — not directly observed on this form)

| # | Field label (typical) | Data type | Likely required? | Notes |
|---|---|---|---|---|
| 2.1 | Employment status | Dropdown | Required | Typical values: Employed, Self-employed, Retired, Student, Homemaker, Unemployed |
| 2.2 | Employer name | Text | Conditional (if employed/self-employed) | — |
| 2.3 | Occupation / job title | Text | Conditional | — |
| 2.4 | Employer address (street/city/state/ZIP) | Text group | Conditional | — |
| 2.5 | Years with employer | Number | Optional | — |
| 2.6 | Annual income | Dropdown (range) | Required | Typical brackets, e.g., <$25k, $25k–$50k, $50k–$100k, $100k–$200k, $200k–$500k, $500k+ |
| 2.7 | Net worth (excluding primary residence) | Dropdown (range) | Required | — |
| 2.8 | Liquid net worth | Dropdown (range) | Required | Cash/securities readily convertible |
| 2.9 | Federal tax bracket / rate | Dropdown (range) | Optional | — |
| 2.10 | Source of funds for this account | Dropdown/multi-select | Required | e.g., Employment income, Investments, Inheritance, Retirement savings, Business income, Other |

## Section 3 — Regulatory & affiliations (INFERRED — not directly observed on this form)

| # | Field label (typical) | Data type | Likely required? | Notes |
|---|---|---|---|---|
| 3.1 | Affiliated with a broker-dealer/FINRA member firm (self or immediate family) | Boolean (Yes/No) | Required | If Yes → firm name (text) |
| 3.2 | Control person / senior officer, director, or 10%+ shareholder of a publicly traded company | Boolean (Yes/No) | Required | If Yes → company name / ticker (text) |
| 3.3 | Politically Exposed Person (senior political figure/public official, or immediate family/close associate) | Boolean (Yes/No) | Required | Standard AML/PEP screening question |
| 3.4 | Existing brokerage accounts at other firms | Boolean (Yes/No) | Optional | Sometimes requested for AML/compliance context |

## Section 4 — Additional details (INFERRED — not directly observed on this form)

| # | Field label (typical) | Data type | Likely required? | Notes |
|---|---|---|---|---|
| 4.1 | Investment objective | Dropdown | Required | e.g., Income, Growth, Growth & Income, Speculation/Aggressive growth, Capital preservation |
| 4.2 | Risk tolerance | Dropdown | Required | e.g., Conservative, Moderate, Aggressive |
| 4.3 | Investment experience (per product: stocks, bonds, options, mutual funds, etc.) | Dropdown per product | Required | e.g., None, Limited, Good, Extensive |
| 4.4 | Time horizon | Dropdown | Required | e.g., Short-term (<3 yrs), Medium (3–10 yrs), Long-term (10+ yrs) |
| 4.5 | Trusted contact person — name | Text | Optional | Per FINRA Rule 2165 |
| 4.6 | Trusted contact person — phone | Text (tel) | Optional | — |
| 4.7 | Trusted contact person — email | Text (email) | Optional | — |
| 4.8 | Trusted contact person — relationship | Dropdown/text | Optional | — |
| 4.9 | Account features requested | Checkboxes | Optional | e.g., Margin, Options trading, Dividend reinvestment |
| 4.10 | Statement/document delivery preference | Radio/dropdown | Required | E-delivery vs paper mail |
| 4.11 | Cost basis method election | Dropdown | Optional | FIFO, LIFO, Specific identification, Average cost |
| 4.12 | Backup withholding / W-9 certification | Checkbox | Required | IRS tax certification |
| 4.13 | Electronic signature / e-consent | Checkbox | Required | Final e-sign step |

---

## Suggested flat schema (for a database/spreadsheet table)

| column_name | section | data_type | required | source |
|---|---|---|---|---|
| first_name | personal_contact | varchar | true | confirmed |
| middle_name | personal_contact | varchar | false | confirmed |
| last_name | personal_contact | varchar | true | confirmed |
| suffix | personal_contact | varchar(enum) | false | confirmed |
| date_of_birth | personal_contact | date | true | confirmed |
| ssn | personal_contact | varchar(9) (encrypted) | true | confirmed |
| email | personal_contact | varchar | true | confirmed |
| mobile_number | personal_contact | varchar | true | confirmed |
| residential_street | personal_contact | varchar | true | confirmed |
| residential_unit | personal_contact | varchar | false | confirmed |
| residential_city | personal_contact | varchar | true | confirmed |
| residential_state | personal_contact | varchar(2) | true | confirmed |
| residential_zip | personal_contact | varchar(10) | true | confirmed |
| has_mailing_address | personal_contact | boolean | false | confirmed |
| mailing_street | personal_contact | varchar | false | confirmed |
| mailing_unit | personal_contact | varchar | false | confirmed |
| mailing_city | personal_contact | varchar | false | confirmed |
| mailing_state | personal_contact | varchar(2) | false | confirmed |
| mailing_zip | personal_contact | varchar(10) | false | confirmed |
| marital_status | personal_contact | varchar(enum: single, married, divorced, widowed) | true | confirmed |
| citizenship | personal_contact | varchar(enum: us_citizen, resident_alien, non_resident_alien) | true | confirmed |
| ssa_verification_consent | personal_contact | boolean | true | confirmed |
| employment_status | employment_finances | varchar(enum) | true | inferred |
| employer_name | employment_finances | varchar | false | inferred |
| occupation | employment_finances | varchar | false | inferred |
| employer_address | employment_finances | varchar | false | inferred |
| years_employed | employment_finances | integer | false | inferred |
| annual_income_range | employment_finances | varchar(enum) | true | inferred |
| net_worth_range | employment_finances | varchar(enum) | true | inferred |
| liquid_net_worth_range | employment_finances | varchar(enum) | true | inferred |
| tax_bracket_range | employment_finances | varchar(enum) | false | inferred |
| source_of_funds | employment_finances | varchar(enum/multi) | true | inferred |
| affiliated_broker_dealer | regulatory_affiliations | boolean | true | inferred |
| affiliated_broker_dealer_firm | regulatory_affiliations | varchar | false | inferred |
| is_control_person | regulatory_affiliations | boolean | true | inferred |
| control_person_company | regulatory_affiliations | varchar | false | inferred |
| is_politically_exposed_person | regulatory_affiliations | boolean | true | inferred |
| has_other_brokerage_accounts | regulatory_affiliations | boolean | false | inferred |
| investment_objective | additional_details | varchar(enum) | true | inferred |
| risk_tolerance | additional_details | varchar(enum) | true | inferred |
| investment_experience | additional_details | varchar(enum, per product) | true | inferred |
| time_horizon | additional_details | varchar(enum) | true | inferred |
| trusted_contact_name | additional_details | varchar | false | inferred |
| trusted_contact_phone | additional_details | varchar | false | inferred |
| trusted_contact_email | additional_details | varchar | false | inferred |
| trusted_contact_relationship | additional_details | varchar | false | inferred |
| account_features | additional_details | varchar(multi) | false | inferred |
| delivery_preference | additional_details | varchar(enum: e_delivery, paper) | true | inferred |
| cost_basis_method | additional_details | varchar(enum) | false | inferred |
| w9_certification | additional_details | boolean | true | inferred |
| esignature_consent | additional_details | boolean | true | inferred |

---

### Caveats
- No real personal data was submitted; sample/placeholder values (e.g., "Jordan Sample") were used only to progress through visible fields.
- No SSN — real or fake — was entered into the form, per policy. This is the reason Sections 2–4 could not be directly observed.
- Field lists for Sections 2–4 are a best-effort industry-standard model, not a verified capture. If exact accuracy for those sections matters, someone will need to complete the live form with real information and this document should be updated with the actual field names/types/options observed.
