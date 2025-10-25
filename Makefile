PYTHON ?= python3
VENV ?= .venv
VENV_BIN := $(VENV)/bin
export PYTHONPATH := $(CURDIR)/src

FOUNDRY ?= forge
NPM ?= npm

SIGN_ENABLED ?= false
UPLOADS_ENABLED ?= false
DEMO_ENV_FILE ?= harvest-estate/.env.demo
SE7EN_DEMO_JWT ?= $(shell awk -F= '/^SE7EN_DEMO_JWT=/{print $$2}' $(DEMO_ENV_FILE) 2>/dev/null)
SE7EN_DEMO_JWT_LAW ?= $(shell awk -F= '/^SE7EN_DEMO_JWT_LAW=/{print $$2}' $(DEMO_ENV_FILE) 2>/dev/null)
SE7EN_DEMO_JWT_OPS ?= $(shell awk -F= '/^SE7EN_DEMO_JWT_OPS=/{print $$2}' $(DEMO_ENV_FILE) 2>/dev/null)
SE7EN_DEMO_JWT_INSURANCE ?= $(shell awk -F= '/^SE7EN_DEMO_JWT_INSURANCE=/{print $$2}' $(DEMO_ENV_FILE) 2>/dev/null)
SE7EN_DEMO_JWT_TREASURY ?= $(shell awk -F= '/^SE7EN_DEMO_JWT_TREASURY=/{print $$2}' $(DEMO_ENV_FILE) 2>/dev/null)
SE7EN_BASE_URL ?= $(shell awk -F= '/^SE7EN_BASE_URL=/{print $$2}' $(DEMO_ENV_FILE) 2>/dev/null)
SE7EN_BASE_URL := $(if $(strip $(SE7EN_BASE_URL)),$(strip $(SE7EN_BASE_URL)),http://localhost:4000)

.PHONY: bootstrap dev lint lint-check test ensure-venv sol-build sol-test oracle oracle-dev frontend frontend-dev devnet-demo docker-up docker-down docker-smoke ledger-export attest-json demo-alpha sign-demo

bootstrap: $(VENV)/bin/activate
	@echo "Virtual environment ready. Run 'source $(VENV)/bin/activate' before developing."

$(VENV)/bin/activate: requirements.txt requirements-dev.txt
	$(PYTHON) -m venv $(VENV)
	$(VENV_BIN)/python -m pip install --upgrade pip
	$(VENV_BIN)/pip install -r requirements.txt
	$(VENV_BIN)/pip install -r requirements-dev.txt
	touch $(VENV)/bin/activate

ensure-venv:
	@if [ ! -x $(VENV_BIN)/python ]; then \
		$(MAKE) bootstrap; \
	fi

dev: ensure-venv
	$(VENV_BIN)/python -m unified_sovereign_estate

lint: ensure-venv
	$(VENV_BIN)/ruff check src tests
	$(VENV_BIN)/black src tests
	touch .lint-ran

lint-check: ensure-venv
	$(VENV_BIN)/ruff check src tests
	$(VENV_BIN)/black --check src tests
	touch .lint-checked

test: ensure-venv
	$(VENV_BIN)/pytest --maxfail=1 --disable-warnings --cov=unified_sovereign_estate --cov-report=term-missing

sol-build:
	$(FOUNDRY) build

sol-test:
	$(FOUNDRY) test -vvvv

oracle:
	cd services/eyeion-oracle && $(NPM) run start

oracle-dev:
	cd services/eyeion-oracle && $(NPM) install

frontend:
	cd frontend && $(NPM) run build

frontend-dev:
	cd frontend && $(NPM) run dev

devnet-demo:
	./scripts/devnet/full-demo.sh

docker-up:
	cd infra && docker compose up --build

docker-down:
	cd infra && docker compose down -v

docker-smoke:
	cd infra && \
	  trap 'docker compose down -v' EXIT && \
	  docker compose up --build -d && \
	  sleep 20 && \
	  docker compose ps

subscribers-dev:
	cd harvest-estate/se7en-backend && SUBSCRIBER_ENABLED=true $(NPM) run dev

ledger-export:
	curl -o ledger.csv http://localhost:4000/api/ledger/export

attest-json:
	cd harvest-estate/se7en-backend && $(NPM) run attest:json -- $(FILES)

demo-alpha:
	$(MAKE) -C harvest-estate build
	SIGN_ENABLED=$(SIGN_ENABLED) UPLOADS_ENABLED=$(UPLOADS_ENABLED) $(MAKE) -C harvest-estate demo
	cd harvest-estate/se7en-backend && ENV_FILE=../.env.demo $(NPM) run verify:env
	cd harvest-estate/se7en-backend && \
	  SE7EN_DEMO_JWT=$(SE7EN_DEMO_JWT) \
	  SE7EN_DEMO_JWT_LAW=$(SE7EN_DEMO_JWT_LAW) \
	  SE7EN_DEMO_JWT_OPS=$(SE7EN_DEMO_JWT_OPS) \
	  SE7EN_DEMO_JWT_INSURANCE=$(SE7EN_DEMO_JWT_INSURANCE) \
	  SE7EN_DEMO_JWT_TREASURY=$(SE7EN_DEMO_JWT_TREASURY) \
	  SE7EN_BASE_URL=$(SE7EN_BASE_URL) \
	  $(NPM) run demo:alpha
	$(MAKE) ledger-export
	cd harvest-estate/se7en-backend && $(NPM) run attest:json -- --output ../attestation-report.json
	$(MAKE) -C harvest-estate stop

sign-demo:
	SIGN_ENABLED=true UPLOADS_ENABLED=true $(MAKE) demo-alpha
