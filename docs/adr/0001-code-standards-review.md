# Code standards review

## Scope

This review assesses the repository as a principal-engineer POC. It focuses on ownership boundaries, naming, build/deployment organization, maintainability, and documentation consistency. It does not change behavior or claim that tests were run as part of this review.

## Target high-level layout

The desired ownership boundaries are:

```text
backend/          Application/server runtime code
frontend/         Browser application code
infrastructure/   Deployment, provisioning, local runtime, and environment code
docs/             Requirements, architecture, ADRs, and research
```

## Findings and corrective actions

| Priority | Finding | Current evidence | Required correction |
| --- | --- | --- | --- |
| P0 | Frontend folder does not use the target name. | The browser application is in `frontend/`. Docker Compose, Worker launch scripts, and documentation use that path. | Rename `frontend/` to `frontend/` and update all references atomically. |
| P0 | Infrastructure folder does not use the target name. | Provider/deployment code is in `infrastructure/`. | Rename `infrastructure/` to `infrastructure/` and update all references atomically. |
| P0 | Cloudflare runtime application code is mixed with infrastructure. | `backend/edge-worker/src/onboarding/` contains API routing, validation, persistence, authentication, and voice/assistant behavior. | Move Worker runtime code to `backend/edge-worker/` or `backend/cloudflare-worker/`. Keep Wrangler configuration, migrations, provisioning, and deployment scripts in `infrastructure/cloudflare/`. |
| P0 | Java and Cloudflare implement the onboarding API/workflow independently. | Java implementation exists under `backend/java-service/src/main/java/com/falcon/onboarding`; Worker implementation exists in `backend/edge-worker/src/onboarding`. | Select a canonical runtime per environment or create a versioned API contract and contract-test suite. Avoid ungoverned duplicate business logic. |
| P1 | Local deployment code is outside the infrastructure boundary. | Root `docker-compose.yml` and `nginx/`. | Move to `infrastructure/local/compose.yaml` and `infrastructure/local/nginx/`. Keep a root task runner for simple developer commands. |
| P1 | Java application identity is stale. | Maven artifact/name/description and main class use `upload-demo` / `UploadDemoApplication`, although the backend contains onboarding and upload domains. | Rename to a neutral service identity such as `falcon-backend` and `FalconApplication`. |
| P1 | Product domains share one Spring application without documented module ownership. | `com.falcon.upload` and `com.falcon.onboarding` are deployed from one Spring Boot executable. | Keep explicit bounded-context package, API-prefix, config, and test boundaries. Split deployables only when independent ownership/scaling requires it. |
| P1 | Documentation has competing sources of truth. | Root `readme.md`, `context.md`, requirement documents, and `File Transfer Business Service.md` overlap. | Keep `README.md` for setup/architecture, `docs/requirements/` for requirements, `docs/adr/` for decisions, and a concise durable `context.md` for context/status only. |
| P1 | Wizard model is inconsistent across documentation. | Some documents/code comments describe 8 screens while newer requirements define 4 consolidated sections. | Confirm the four-section model as canonical and mark the eight-screen design superseded everywhere. |
| P1 | External/research field inventory is unclassified at repository root. | `docs/research/account-opening-field-inventory.md`. | Move to `docs/research/` with provenance, status, and distribution guidance, or remove it from the POC repository. |
| P2 | Build scripts are coupled to historical folder names. | Cloudflare launch scripts and Wrangler assets path hard-code `frontend/`. | Centralize paths in a task runner/build configuration and refer only to the canonical `frontend/` location. |
| P2 | Repository-document names are inconsistent. | Lowercase `readme.md`; root `File Transfer Business Service.md`; spaced names. | Standardize to `README.md` and kebab-case documents, for example `docs/file-transfer-business-service.md`. |
| P2 | Generated artifacts are present locally. | `backend/target/` and `frontend/dist/`. | Continue ignoring them; ensure runbooks generate artifacts and do not treat them as source. |

## Recommended target structure

```text
backend/
  java-service/                 Spring Boot source, tests, Dockerfile
  edge-worker/                  Cloudflare Worker runtime source and tests
  contracts/                    Versioned API schemas and shared fixtures

frontend/
  src/
  public/
  package.json
  Dockerfile

infrastructure/
  cloudflare/                   Wrangler, migrations, provisioning, deployment scripts
  local/                        Compose and nginx configuration
  environments/                 Non-secret example environment files

docs/
  requirements/
  architecture/
  adr/
  research/

README.md
Makefile
```

## Migration order

1. Decide and document the canonical onboarding runtime and API-contract ownership.
2. Add contract tests before moving runtime implementations.
3. Rename `frontend/` to `frontend/` and `infrastructure/` to `infrastructure/` in one mechanical change.
4. Move local Compose/nginx resources below `infrastructure/local/`.
5. Separate Cloudflare runtime code from Cloudflare provisioning/deployment code.
6. Rename Java service/app artifact identity and normalize root documentation.
7. Move research and business-service documents into `docs/` and update all links.
8. Run the relevant build, unit, integration, and deployment checks after each migration phase.

## Architectural decision required

The most important open decision is whether the Cloudflare Worker is the primary production onboarding backend or only an edge gateway to the Java backend. The current parallel implementation can be appropriate for a POC, but it requires an explicit API contract and parity tests. Without those controls, the two implementations will drift.
