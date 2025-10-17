PYTHON ?= python3
VENV ?= .venv
VENV_BIN := $(VENV)/bin
export PYTHONPATH := $(CURDIR)/src

FOUNDRY ?= forge
NPM ?= npm

.PHONY: bootstrap dev lint lint-check test ensure-venv sol-build sol-test oracle oracle-dev frontend frontend-dev devnet-demo

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
