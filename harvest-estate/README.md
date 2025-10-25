# HRVST Sovereign Finance Stack
**Harvest Estate | Humonics Energy Enterprises | Se7en Alpha Infrastructure**

---

## Overview
This repository packages the sovereign Web3 finance infrastructure for the Harvest Estate. It coordinates orchestration, treasury, and audit modules across the following services:

| Module | Function |
|--------|----------|
| **Se7en** | Backend orchestration and fiduciary logic engine |
| **API Gateway** | Flask controller for intake → redemption workflow + verification |
| **Eklesia** | Blockchain anchoring & transaction notarization |
| **VaultQuant** | Token issuance, NAV, and liquidity management |
| **SafeVault** | Sovereign data storage & CPA audit vault |
| **Eyeion** | On-chain attestation & hash verification |
| **Matriarch Insurance** | Reserve multiplier and reinsurance mechanism |
| **Kïïantu Treasury** | Yield distribution and liquidity routing |
| **HRVST Liquidity** | Portfolio-backed fractional tokenization |

---

## Architecture
Dockerized full-stack system with a dual-mode Demo ↔ Live toggle.

```
harvest-estate/
├── docker-compose.yml
├── .env.demo / .env.live
├── api-gateway            # Flask + SQLAlchemy workflow controller
├── contracts              # Foundry Solidity suite (CSDN, SDN, HRVST, etc.)
├── se7en-backend          # Fastify + Prisma backend
├── frontend               # Next.js fiduciary console + redeem UI
└── infra                  # Dockerfile, scripts, seeded artifacts

Workflow data tables now include assets, issuances, insurance bands, affidavits, users, and ledger logs to support investor demo audit traces.
```

---

## Environment Modes
| Mode | Purpose | KMS | Treasury Policy |
|------|---------|-----|-----------------|
| **DEMO** | Simulated on-chain operations | MOCK | α = 0.75, Spread = 50 bps |
| **LIVE** | Production ledger with insured reserves | VAULT | α = 0.85, Spread = 25 bps |

---

## Quick Start

### Build Containers
```bash
docker-compose build
```

### Configure Environment
Copy the provided examples and update contract addresses and orchestrator key as needed:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
# populate EKLESIA_ADDRESS, SAFEVAULT_ADDRESS, etc. before running in live mode
# set JWT_SECRET and mint role tokens via `npm run jwt:create`
# assign generated values to SE7EN_DEMO_JWT / NEXT_PUBLIC_SE7EN_JWT as needed
```

### Launch in Demo Mode
```bash
make demo
```

### Launch in Live Mode
```bash
make live
```

### Run Tests
```bash
make test
```

Tests run:
- NAV validation (`nav.test.ts`)
- Redemption guardrails (`redemption.guard.test.ts`)
- Ledger idempotency checks

### Sovereign API Gateway
Flask controller exposed at `http://localhost:5050` orchestrates the intake → redemption workflow and investor verification.

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/intake` | Register or update collateral intake metadata |
| `POST` | `/insurance` | Apply Matriarch multiplier + coverage JSON payload |
| `POST` | `/mint` | Issue HRVST against approved assets (records Se7en ledger entry) |
| `POST` | `/circulate` | Relay liquidity loop execution to the Kïïantu desk |
| `POST` | `/redeem` | Proxy redemption requests into Se7en treasury guardrails |
| `GET` | `/verify/<affidavitHash>` | Surface Eyeion affidavit metadata for investors |

```bash
curl -X POST http://localhost:5050/mint \
  -H "Content-Type: application/json" \
  -d '{"externalId":"HAS-ALPHA","quantity":380038.75,"navPerToken":0.91,"policyFloor":0.85}'
```

> **Env prerequisites**: the orchestrator expects `HARDHAT_RPC`, `ORCHESTRATOR_PRIVATE_KEY`, and contract addresses (`EKLESIA_ADDRESS`, `SAFEVAULT_ADDRESS`, `EYEION_ADDRESS`, `VAULTQUANT_ADDRESS`, `MATRIARCH_ADDRESS`, `HRVST_ADDRESS`, `KIANITU_ADDRESS`, `ANIMA_ADDRESS`) to be present before boot.

### Demo Seed Flow

Deploy lightweight demo contracts to Anvil and refresh `.env.demo` with their addresses:

```bash
cd se7en-backend
npm run deploy-demo-contracts
```

> This script recompiles the in-repo Solidity stubs with `solc`, deploys them to the local Anvil node, and writes the resulting addresses (plus the funded deployer key) into `.env.demo`.

To run the full Haskins Alpha lifecycle (intake → insurance → issuance → cycle → redemption):

```bash
cd se7en-backend
npm run demo-seed
```

Set `CONTRACTS_MODE=STUB` (for example in `.env.demo`) if you want to exercise the flow without touching the chain. In stub mode the `recordAttestation`, coverage binding, and cycle bookkeeping are handled in-memory, so the script completes end-to-end even when Anvil or contract addresses are unavailable.

The script summarizes attestation IDs per step and skips assets with outstanding evidence (e.g., Compton #24 document hashes).

---

## Redeem Tokens (Demo)
```bash
curl -X POST http://localhost:4000/treasury/redeem \
  -H "Content-Type: application/json" \
  -d '{"holderId":"RUDY-CELAYA-001","tokens":1500}'
```

Expected response:
```json
{
  "ticket": { "id": 72, "holderId": "RUDY-CELAYA-001" },
  "usdOwed": 1275.0,
  "price": 0.85,
  "navPerToken": 0.90
}
```

---

## NAV Model
\[
\mathrm{NAV}_t = \frac{\mathrm{TreasuryStable} + \mathrm{InsuredReserves} + \mathrm{RealizedYield} - \mathrm{Liabilities}}{\mathrm{Supply}}
\]

\[
\mathrm{Price}_t = \min(\mathrm{NAV}_t,\ \mathrm{NAV}_t \times \alpha) \times \left(1 - \frac{\mathrm{Spread}_{bps}}{10\,000}\right)
\]

---

## Redemption Flow
1. Holder submits redemption (`POST /treasury/redeem`)
2. Se7en verifies balances and policy gates
3. HRVST tokens burn and Treasury debits stable reserve
4. CPA ledger line item + Eyeion hash recorded
5. NAV recalculation propagates to dashboard

## Investor Demo Seed — Haskins Alpha
`make seed-demo` resets the demo schema and loads:
- **Haskins Alpha Estate (CSDN)** — $875,000 collateral, Matriarch 3.5× coverage, 380,038.75 HRVST issuance.
- **Meridian Beta IP Trust (SDN)** — $620,000 valuation pending multiplier confirmation.
- Fiduciary roster (Law, CPA, Treasury, Insurance, Ops, Governance, Oracle) for workflow sign-offs.
- Ledger logs and Eyeion affidavits powering `/verify/<hash>` demonstrations.

---

## Security Controls
- JWT signatures on API routes
- Circuit breakers on large redemptions
- 4‑witness quorum verification (Se7en, Eyeion, VaultQuant, CPA)
- Live monitoring at `/api/nav/preview` (SSE stream)

### JWT Tokens
- `JWT_SECRET` is required for Se7en to verify HMAC (HS256) signatures. Optional `JWT_ISSUER`/`JWT_AUDIENCE` can be supplied for additional checks.
- Generate fiduciary tokens with `npm run jwt:create <ROLE> [subject]` inside `se7en-backend/`. Example:
  ```bash
  ENV_FILE=../.env.demo npm run jwt:create TREASURY demo-treasury
  ```
- Assign the resulting token to `SE7EN_DEMO_JWT` for automation scripts and/or `NEXT_PUBLIC_SE7EN_JWT` for the Next.js fiduciary console.
- Route protection matrix:
  | Route | Roles |
  |-------|-------|
  | `POST /intake` | LAW, OPS |
  | `POST /insurance` | INSURANCE |
  | `POST /mint` | TREASURY, OPS |
  | `POST /circulate` | TREASURY, OPS |
  | `POST /redeem` | TREASURY |

### DocuSign Signing
- Enable with `SIGN_ENABLED=true` (the `make sign-demo` target sets this automatically).
- Issue envelopes via `POST /sign/envelope` (LAW/OPS roles) and ingest Connect callbacks through `POST /sign/webhook`.
- Events persist to `SignatureEnvelope` / `SignatureEvent` tables for auditing.

### SafeVault Uploads
- Toggle with `SAFEVAULT_UPLOADS_ENABLED=true` (enabled automatically during `make sign-demo`).
- Upload custody files via `POST /vault/upload` (LAW/OPS roles) using base64-encoded payloads; records land in `CustodyDoc` with the computed SHA-256.
- Notifications are delivered over SMTP (MailHog by default at `http://localhost:8025`). Configure recipients with `SAFEVAULT_NOTIFICATION_TO`.
- See `docs/vault.md` for the full runbook.

---

## Exports & Observability
- `make ledger-export` downloads a CPA-ready CSV
- `make nav-ticker` streams the live NAV SSE feed
- `make redeem-demo` executes a scripted redemption pass
- `make sign-demo` runs the automation loop with DocuSign signing and SafeVault uploads
- MailHog web UI: http://localhost:8025 (SMTP inbox for demo emails)

---

## Roadmap
| Phase | Objective |
|-------|-----------|
| **Alpha** | NAV engine, live/demo toggle, redemption demo |
| **Beta** | Kïïantu Treasury yield routing, Matriarch reserve oracle |
| **Gamma** | Fiduciary multi-sig, auditor webhooks, insurance corridors |

---

## Verification
Each redemption yields:
- SHA256 digest captured in Eyeion
- CPA ledger entry persisted in SafeVault
- Optional audit URL for external review

---

## Summary
The HRVST platform demonstrates a real asset–backed, yield-linked, on-demand liquidity system for the sovereign estate—bridging trust law, blockchain transparency, and portfolio performance into one automated financial organism.
