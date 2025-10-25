# Haskins Alpha Investor Demo Runbook

This playbook drives the Wednesday investor walkthrough for the Harvest Estate sovereign liquidity stack. It assumes `docker-compose` is running in **Demo** mode with the seeded dataset.

## 1. Verify Health
```bash
curl http://localhost:5050/health
curl http://localhost:4000/api/nav
```

## 2. Intake Confirmation (SafeVault → Se7en)
Re-affirm intake metadata for Haskins Alpha.
```bash
curl -X POST http://localhost:5050/intake \
  -H "Content-Type: application/json" \
  -d '{"externalId":"HAS-ALPHA","name":"Haskins Alpha Estate","assetType":"CSDN","jurisdiction":"US-DE-TRUST","valuationUsd":875000}'
```

## 3. Matriarch Multiplier Application
Applies the 3.5× reserve band and records coverage JSON into Postgres.
```bash
curl -X POST http://localhost:5050/insurance \
  -H "Content-Type: application/json" \
  -d '{"externalId":"HAS-ALPHA","multiplier":3.5,"coverageUsd":3062500,"jurisdiction":"US-DE","floor":0.85}'
```

## 4. Mint HRVST Liquidity
Issues 380,038.75 HRVST tokens against the verified asset and publishes a ledger log.
```bash
curl -X POST http://localhost:5050/mint \
  -H "Content-Type: application/json" \
  -d '{"externalId":"HAS-ALPHA","quantity":380038.75,"navPerToken":0.91,"policyFloor":0.85}'
```

## 5. Circulate via Kïïantu Desk
Demonstrate the 90‑day liquidity loop.
```bash
curl -X POST http://localhost:5050/circulate \
  -H "Content-Type: application/json" \
  -d '{"externalId":"HAS-ALPHA","amountUsd":360000,"tenorDays":90}'
```

## 6. Redemption Showcase
Use the API gateway to trigger a Se7en redemption guardrail run.
```bash
curl -X POST http://localhost:5050/redeem \
  -H "Content-Type: application/json" \
  -d '{"externalId":"HAS-ALPHA","holderId":"INVESTOR-DEMO-001","tokens":1250}'
```

## 7. Investor Verification Card
Present the Eyeion affidavit hash surfaced through the console.
```bash
curl http://localhost:5050/verify/f3751987e4c854786c34b50337b504930b444a3fb4678b01f644fdb7caae34a9
```
> Use the Meridian Beta hash `c8df8ff4401a7ffe17088ae35c3af1c6bdf09f1d11c69644c61b643c01290abb` for the secondary asset.

## 8. Frontend Walkthrough
Navigate to `http://localhost:3000/dashboard`:
- Toggle Demo ↔ Live mode to reveal violet/gold gradients.
- Showcase fiduciary signatures, NAV ticker, and the Eyeion verification card.
- Open `/verify/<hash>` to present the affidavit details live.

## 9. Tear Down
```bash
make stop
```
