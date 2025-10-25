# Harvest Estate Sovereign Liquidity — Integration Plan

## Current Snapshot
- Solidity contract suite (AccessRoles, EklesiaAttestor, AffidavitRegistry, SafeVault, VaultQuant, MatriarchInsurance, HRVST, KiiantuCycles, AnimaOS) compiled under Foundry with core invariants covered by tests.
- Docker stack scaffolds 10 services (eklesia, vaultquant, safevault, eyeion, matriarch, kiiantu, anima, se7en, api-gateway, frontend) on shared `sovereign-net` and `public-bridge` networks.
- Docker stack now includes an Anvil Hardhat node with health checks across se7en, api-gateway, and frontend; `.env.example` seeds orchestrator configuration.
- Postgres schema now includes assets, issuances, insurance bands, affidavits, users, ledger logs, and audit log storage; seed script populates Haskins/Meridian demo data.
- Se7en Fastify orchestrator exposes `/intake`, `/mint`, `/insurance`, `/circulate`, `/redeem`, and `/verify/:id` against live contract ABIs with append-only audit logging.
- Frontend Next.js console still limited to NAV ticker + redemption; fiduciary console and verification screens remain pending.
- Flask gateway, workflow automation scripts, and investor demo playbooks not yet added.

## Delivery Tracks
1. **Ledger & Contracts** *(Stage 1 — complete)*
   - Foundry suite committed with baseline tests for issuance gate, policy floor, insurance band, attestation integrity, and redemption.
   - Remaining: deployment/broadcast scripts + artifact export pipeline.
2. **Data Layer Expansion** *(Stage 2 — in progress)*
   - Prisma schema extended; audit log model live. **TBD:** Align Flask/SQLAlchemy mirror once gateway work begins.
   - Seed scripts seeded Haskins Alpha + Meridian Beta tables; orchestrator seeding flow (`npm run demo-seed`) exercises Haskins end-to-end. **Needed evidence:** contract deployments + Compton #24 hashes.
3. **API Gateway (Flask)**
   - Scaffold `api-gateway/` service (Flask + SQLAlchemy + web3.py) handling `/intake`, `/mint`, `/insurance`, `/circulate`, `/redeem`, `/verify/<id>`.
   - Implement orchestration bridge to Se7en (REST) and Eklesia contracts (via Node/viem or web3.py provider).
   - Provide demo-mode synthetic responses when ledger not broadcast.
4. **Se7en Automation** *(Stage 2 — partial)*
   - REST flows wired; TODO: background workflow orchestration, alerting adapters, and job queue integration.
5. **Microservice Stubs**
   - Convert placeholder Node containers (eklesia, vaultquant, safevault, eyeion, matriarch, kiiantu, anima) into minimal ES module services under `services/`.
   - Each service exposes health endpoints, receives workflow events from Se7en, and interacts with shared Postgres / Redis (if required).
6. **Frontend Console** *(Stage 4 — complete)*
   - Mode toggle, fiduciary panels, dossier export, and verification screen live. **TODO:** holographic node map + extended Ops visuals.
7. **Testing & Verification**
   - Author Foundry tests for minting, insurance multipliers, redemption flows.
   - Expand Jest/RTL (frontend) and Vitest/Fastify harness for workflow coverage.
   - Provide end-to-end script under `scripts/demo/haskins-alpha.sh` to replay the investor demonstration.
8. **Documentation & Runbooks**
   - Update README, docs/runbooks, and .env examples to cover new services, ports, and operational modes.
   - Deliver investor-facing summary and engineering runbook for Wednesday demo.

## Immediate Next Steps
1. Wire deployment scripts + ABI exports for the Solidity suite.
2. Scaffold Flask API gateway with SQLAlchemy mirror and contract bridge.
3. Replace placeholder microservices with minimal health-aware implementations and event bus connectors.
