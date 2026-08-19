# Onboarding API contract

The onboarding API is implemented twice — by the Cloudflare Worker (`backend/edge-worker`, the
canonical production runtime) and by the Java service (`backend/java-service`, the reference
implementation). Cloudflare Workers cannot run a JVM, so the duplication is structural rather than
accidental.

Duplication that nothing enforces will drift. `onboarding-field-catalogue.json` is the single source
of truth for the things the two runtimes must agree on, and both have parity suites that fail when
they disagree:

| Runtime | Parity suite |
| --- | --- |
| Edge worker | `backend/edge-worker/src/onboarding/domain/contractParity.test.ts` |
| Java service | `backend/java-service/src/test/java/com/falcon/onboarding/contract/OnboardingContractParityTest.java` |

Behaviour present in one runtime and absent from the other is a defect, not a variation.

## Changing a field

1. Edit `onboarding-field-catalogue.json`.
2. Run `make test`. The parity suites will name every runtime that now disagrees.
3. Update those runtimes until both suites pass.

Do the steps in that order. The contract leads; the implementations follow.

## Scope

Covers only what the runtimes must agree on: which fields exist, which are required, and which
values controlled-selection fields accept.

Presentation concerns — field labels, control types, step grouping — stay in the frontend, where a
difference is harmless. Bumping `version` signals a breaking change to consumers.
