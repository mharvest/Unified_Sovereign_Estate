# Docker Stack Runbook

This guide brings the sovereign stack up with Docker Compose, mirroring what the CI smoke test executes.

## Prerequisites
- Docker Desktop 4.29+ or compatible Engine with Compose v2.
- Enough free disk space for Node, Postgres, Foundry layers (~6 GB first run).
- The repo root checked out locally (Compose files live under `infra/`).

## Build & Launch
Use the Makefile wrappers to keep commands consistent with CI:

```bash
make docker-up
```

The target runs `docker compose up --build` from `infra/`, compiling the contracts image (Anvil), booting the API/services, and starting the Next.js UI. Logs stream to the terminal; stop with <kbd>Ctrl+C</kbd>.

To run the same smoke flow headless that CI performs:

```bash
make docker-smoke
```

This target brings the stack up in detached mode, waits 20 seconds for health checks, prints container status, and always tears the environment down.

## Services & Ports
- **Anvil** (`contracts`): http://127.0.0.1:8545, chain ID `777`.
- **Postgres** (`db`): exposed on `5432` with credentials `estate`/`estate` and database `harvest_estate`.
- **API**: http://127.0.0.1:4000/health.
- **Auth/VaultQuant/SafeVault/Se7en/Data**: Fastify stubs on ports `4011`–`4020`.
- **Oracle**: consumes Anvil events at `http://contracts:8545` (offline Eyeion mock).
- **Frontend**: http://127.0.0.1:3000.

## Tear Down & Cleanup
```bash
make docker-down
```

This removes Compose services and the bound Postgres volume (`db_data`). If you ran `docker-up` directly, use `Ctrl+C` followed by `make docker-down` to clean lingering volumes.

## Troubleshooting
- **Image pulls fail**: verify Docker has network access; macOS users should allow the Desktop app through firewalls.
- **Oracle exits immediately**: ensure the `contracts` (Anvil) service is healthy; check `docker compose logs oracle contracts`.
- **Frontend 500s**: the UI expects the API on `http://hrvst-api:4000`; confirm the API container is healthy or override `NEXT_PUBLIC_*` envs before rebuilding the image.

Keep runbook updates in sync with CI or `infra/docker-compose.yml` changes.
