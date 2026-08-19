# Single entry point for development tasks.
#
# Directory paths are defined once here so scripts, docs and humans stop hardcoding sibling
# directory names - the coupling that made the repository restructure risky in the first place.

JAVA_SERVICE   := backend/java-service
EDGE_WORKER    := backend/edge-worker
FRONTEND       := frontend
CLOUDFLARE     := infrastructure/cloudflare
COMPOSE_FILE   := infrastructure/local/compose.yaml

# The Java toolchain runs in a container so no local JDK or Maven install is required.
MVN := docker run --rm -v "$(PWD)/$(JAVA_SERVICE)":/build -w /build -v maven-repo:/root/.m2 maven:3.9-eclipse-temurin-21 mvn

.DEFAULT_GOAL := help
.PHONY: help install test test-java test-worker test-frontend check build deploy up down clean

help: ## Show available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "};{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install frontend and edge-worker dependencies
	cd $(FRONTEND) && npm ci
	cd $(EDGE_WORKER) && npm ci

test: test-java test-worker test-frontend ## Run every test suite

test-java: ## Java reference implementation (81 tests)
	$(MVN) test

test-worker: ## Edge worker, the canonical runtime (46 tests)
	cd $(EDGE_WORKER) && npm test

test-frontend: ## Frontend (89 tests)
	cd $(FRONTEND) && npx vitest run

check: ## Typecheck and lint every project
	cd $(EDGE_WORKER) && npm run check
	cd $(FRONTEND) && npx tsc --noEmit && npx oxlint src

build: ## Production build of the frontend assets the Worker serves
	cd $(FRONTEND) && npm run build

deploy: ## Full containerised deploy: test, build, provision, ship
	cd $(CLOUDFLARE) && npm run launch:docker

up: ## Start the local Java + frontend + nginx stack
	docker compose -f $(COMPOSE_FILE) up --build

down: ## Stop the local stack
	docker compose -f $(COMPOSE_FILE) down

clean: ## Remove build output
	rm -rf $(FRONTEND)/dist $(JAVA_SERVICE)/target
