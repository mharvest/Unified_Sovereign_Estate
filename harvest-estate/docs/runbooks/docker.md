# Docker Orchestration Runbook

This runbook covers the sovereign stack using Docker Compose. All services run on the `sovereign-net` backend network with `public-bridge` exposing the UI/API.

## Prerequisites
- Docker Engine 24+
- `.env` file populated from `.env.example` with contract addresses and orchestrator key
- For local demo flows, no contract deployments are required (placeholders default to the null address)

## Services & Ports
| Service | Purpose | Port |
|---------|---------|------|
| `anvil` | Local L1 (Foundry Anvil) | 8545 |
| `postgres` | Se7en state store | 5433 (mapped) |
| `se7en` | Orchestrator & REST APIs | 4000 |
| `api-gateway` | Flask gateway | 5050 |
| `frontend` | Next.js fiduciary console | 3000 |
| `mailhog` | SMTP capture & web UI | 1025 / 8025 |
| `eklesia`, `safevault`, `vaultquant`, `eyeion`, `matriarch`, `kiiantu`, `anima` | Service stubs awaiting full implementations | internal only |

Health checks are configured per service (`wget`/`cast`/Python urllib) so Compose waits for each dependency before starting dependents.

## Commands
```bash
# Build all service images
make build

# Launch the demo stack (uses `.env` values)
make demo

# View logs aggregated across services
make logs

# Stop and remove containers
make stop

# Export ledger CSV
make ledger-export

# Generate attestation report JSON (prints to stdout)
make attest-json

# Run the demo automation loop
make demo-alpha

# Run the signing + upload demo loop (MailHog + SafeVault)
make sign-demo
```

## Subscriber Poller
- The Se7en backend starts without the on-chain subscriber by default. Enable it during development with:
  ```bash
  make subscribers-dev
  ```
- Ensure `HARDHAT_RPC` (or `SUBSCRIBER_RPC_URL`) points at a reachable node and `SUBSCRIBER_ENABLED=true` is set via the target above.

## Seeding Workflow
After the stack is healthy, seed the demo asset lifecycle:
```bash
cd se7en-backend
npm run demo-seed
```
The script reports attestation IDs per stage and flags missing evidence (e.g. contract addresses, Compton #24 hashes).

### Demo Automation Notes
- `make demo-alpha` accepts toggles, for example:
  ```bash
  SIGN_ENABLED=true UPLOADS_ENABLED=true make demo-alpha
  ```
- `make sign-demo` is a shortcut that sets `SIGN_ENABLED=true` and executes the automation loop.
  These variables pass through to `docker compose` so you can exercise optional signing or upload flows during the run.

## Troubleshooting
- **Health check flapping**: ensure ports 3000/4000/5050/8545 are not already in use.
- **Anvil not reachable**: run `docker compose logs anvil` and verify the `cast` health check; increase `retries` if your machine is slow.
- **Se7en fails with `ADDRESS is required`**: double-check the contract address variables in `.env`.
- **Frontend CSP violations**: update `NEXT_PUBLIC_SE7EN_API_URL` / `NEXT_PUBLIC_EKLESIA_API_URL` so they match the domains used by your browser when connecting.
