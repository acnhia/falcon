# Brokerage onboarding partner POC — frontend requirements

## Scope

React provides the account-onboarding dashboard, capture-link experience, global-market ticker, and mock conversational-assistance UI. The browser is never trusted with provider secrets or long-lived storage credentials.

## Screens and routes

| Route | Purpose |
| --- | --- |
| `/` | POC landing page: the Personal information workspace, including synthetic application start, form, guided chat, and mock voice control. |
| `/applications/:publicReference` | Lifecycle state, capture-link request, status, and mock-result summary. |
| `/capture/:token` | Mobile-first document capture for the short-lived token. |

## Personal-information workspace POC

This iteration focuses on the first interactive account-onboarding workspace, rather than attempting to implement all 21 onboarding stages at once. It is a synthetic, clearly labelled demonstration and must not collect real applicant information.

### Layout and visual direction

- The root route `/` is the POC landing page and opens to **Personal information — stage 2 of 21**. The stage label is prominent at the top, with a compact progress indicator and an honest statement that later stages are not yet active in this POC. `/onboarding` may redirect to `/` for compatibility while the POC is limited to this workspace.
- Use an original, calm, high-contrast dark fintech interface with accessible text, visible focus states, responsive breakpoints, and large, clearly labelled text inputs. A restrained green accent may communicate active, successful, or positive states; neutral and semantic error/warning colours must remain distinct. Dark styling must meet WCAG contrast expectations; it must not rely on colour alone for state, errors, or progress.
- The visual direction may take broad inspiration from familiar consumer-finance products—dark surfaces, strong whitespace, concise typography, and green positive-state accents—but it must not copy any company’s branding, logo, name, icon set, screenshots, proprietary component designs, or distinctive trade dress. The POC needs its own design tokens, components, and identity.
- The primary workspace is a two-column layout:
  - **Left panel:** the current onboarding form, beginning with synthetic personal-information fields.
  - **Right panel:** a persistent guided conversation panel. On narrow screens, this panel becomes a deliberate, accessible drawer or stacked section; it must not disappear.
- A voice-input control sits at the bottom of the conversation panel, visually similar to a voice prompt. It must only request microphone permission after an explicit user action and must always provide an equivalent keyboard/text path.

### POC interaction model

- The assistant can ask for one field at a time, explain why it is requested in the demo, and propose values for the form from user-provided text or mock voice transcription.
- Proposed values are shown as editable drafts with a visible source indicator such as `Suggested by mock assistant`. The application must never silently write, submit, or overwrite a field.
- The user must explicitly accept, edit, or reject every proposed value. Form validation runs on the accepted/editable value, not on the assistant message.
- The first POC uses a deterministic mock assistant and mock speech pipeline. It does not call a live AI, voice, brokerage, or identity provider, and it must say so in the UI.
- Use a safe synthetic profile or obviously fictional values for demos. The page must warn users not to enter real PII and must not persist entered values beyond the current demo session until a separately approved persistence requirement is implemented.

### Initial form fields

The first POC may show these fields as synthetic-demo fields: preferred name, email-format contact value, phone-format contact value, residential country, and date-of-birth format. It must not request or store a real tax ID, driver-license number, brokerage credential, funding data, or account number.

### Acceptance criteria

- A visitor can start the personal-information workspace and see the stage heading, form, chat panel, voice control, and mock-data disclaimer without scrolling on a typical desktop viewport.
- A text conversation can propose a value for a supported field; accepting it populates the associated form input, while rejecting it leaves that input unchanged.
- A mock voice interaction follows the same proposal/accept/reject workflow. Microphone permission is requested only after pressing the voice control; denial leaves text chat fully usable.
- The user can edit any populated value directly, clear it, and correct it without losing the rest of the form.
- The UI announces assistant proposals, validation errors, microphone states, and save/progress status accessibly.
- The screen is responsive, keyboard-operable, and usable without a camera or microphone.
- No provider secret, raw audio, real PII, or full conversation transcript is sent to browser logs, analytics, or client-side persistence.

### Out of scope for this iteration

- Real speech-to-text, text-to-speech, or AI-model calls.
- Automatic submission, account opening, suitability assessment, investment advice, or regulated decisioning.
- Implementing every field and UI of all 21 stages. Later stages will be represented by progress/status only until their individual requirements are implemented.

## User stories

### UI-ONB-001 — Create and view an application

**As a demo visitor,** I can create a synthetic onboarding application and see its public reference and current lifecycle state.

**Acceptance criteria**

- The page identifies itself as a synthetic, demo-only brokerage onboarding flow.
- It does not request name, tax ID, address, or real account information.
- Network, server, and validation errors have accessible, non-sensitive messages.

### UI-ONB-002 — Request and copy a capture link

**As a demo user,** I can request and copy a camera-capture link.

**Acceptance criteria**

- The UI renders the token URL only after the backend creates it.
- It displays the expiry time and warns that the link is one-time use.
- It provides an accessible copy action and never renders internal IDs.

### UI-CAP-001 — Request browser camera permission deliberately

**As a capture user,** I can opt into camera access when I am ready to capture a document side.

**Acceptance criteria**

- Camera permission is requested only after the user presses a capture action.
- Permission denial shows file selection as a development fallback and explains that no image was uploaded.
- The page releases the camera stream when capture completes, is cancelled, or the component unmounts.

### UI-CAP-002 — Capture front and back images

**As a capture user,** I can capture, preview, retake, and submit both document sides.

**Acceptance criteria**

- The UI clearly identifies `Front` and `Back` steps.
- A preview is visible before upload; retake replaces only the selected side.
- Submit remains disabled until both valid images are present.
- Upload progress, errors, and completion are announced accessibly.

### UI-CAP-003 — Handle an invalid link safely

**As a capture user,** I receive a generic safe message when a link is expired, invalid, or already used.

**Acceptance criteria**

- The UI must not disclose application metadata, token state details, or document data.
- It offers a generic instruction to return to the onboarding application.

### UI-MKT-001 — Present market ticker data responsibly

**As a demo visitor,** I can read global market indicators with their data status.

**Acceptance criteria**

- Each item includes market name, value, change, source, and as-of timestamp.
- A fixture/delayed badge is always visible in mock mode.
- A disabled market, including Russia/MOEX by default, displays a non-speculative “not enabled” state.

### UI-AI-001 — Use mock onboarding assistance

**As a demo user,** I can ask onboarding questions and receive an explicitly mock assistant response.

**Acceptance criteria**

- The UI shows a disclaimer that responses are not financial, legal, or account-opening advice.
- It uses only the backend API and sends no provider API key from the browser.
- Voice controls are disabled or labelled mock until an approved server-side provider is configured.

## Browser and data requirements

- Accept JPEG, PNG, or WebP only; enforce a configurable client-side size limit before upload while relying on backend validation as the authority.
- Do not save images, capture tokens, or application information to browser local storage.
- Do not include image bytes, token values, or PII in analytics or console logging.
- Use responsive layouts suitable for current mobile browsers and keyboard-accessible desktop flows.

## Frontend testing

- Component tests cover all screen states, disabled controls, error paths, and accessibility labels.
- Mock browser-media tests cover permission grant, denial, stream cleanup, front/back replacement, and submission gating.
- API client tests cover server failures and no-secret request behavior.
- End-to-end tests cover creation through validated mock result using synthetic fixture files only.
- The consolidated four-section wizard and its bottom background-status rail must implement [wizard component user stories](06-wizard-component-user-stories.md).
