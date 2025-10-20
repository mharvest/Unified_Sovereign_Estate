# HRVST Sovereign Finance Stack
**Harvest Estate | Humonics Energy Enterprises | Se7en Alpha Infrastructure**

---

## Overview
This repository packages the sovereign Web3 finance infrastructure for the Harvest Estate. It coordinates orchestration, treasury, and audit modules across the following services:

| Module | Function |
|--------|----------|
| **Se7en** | Backend orchestration and fiduciary logic engine |
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
├── .env.demo
├── .env.live
├── se7en-backend          # Fastify + Prisma backend
├── frontend               # Next.js fiduciary console + redeem UI
└── infra                  # Dockerfile, scripts, seeded artifacts
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

---

## Security Controls
- JWT signatures on API routes
- Circuit breakers on large redemptions
- 4‑witness quorum verification (Se7en, Eyeion, VaultQuant, CPA)
- Live monitoring at `/api/nav/preview` (SSE stream)

---

## Exports & Observability
- `make ledger-export` downloads a CPA-ready CSV
- `make nav-ticker` streams the live NAV SSE feed
- `make redeem-demo` executes a scripted redemption pass

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
