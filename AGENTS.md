# Repository Guidelines

Unified Sovereign Estate is the sovereign Codex stack. Keep this guide current for the next agent.

## Project Structure & Modules
- `contracts/` holds Solidity sources (HRVST token, CSDN lifecycle, governance) with utilities in `utils/` and shared interfaces in `interfaces/`.
- `script/` contains Foundry execution scripts plus the `KycRootGenerator.js` Merkle utility.
- `test/` hosts Foundry tests; `tests/` keeps Python smoke/automation coverage.
- `services/eyeion-oracle/` is the Node/viem watcher pushing payloads to Eyeion and the SafeVault cache.
- `frontend/` is the Next.js + Tailwind fiduciary console with hooks in `lib/` and UI atoms in `components/`.
- `src/`, `infra/`, `docs/`, and `assets/` retain application runtime, infrastructure, long-form notes, and seeded artifacts respectively.

## Build, Test, and Development Commands
All entry points are wired through `Makefile`:
- `make bootstrap` / `make dev` / `make lint[-check]` / `make test` — maintain the Python automation layer.
- `make sol-build` / `make sol-test` — wrappers for `forge build` and `forge test -vvvv` (see `foundry.toml`).
- `make oracle-dev` then `make oracle` — install and run the Eyeion oracle (`services/eyeion-oracle/.env` required).
- `make frontend-dev` / `make frontend` — install dependencies, run the Next.js console, and `npm run test:e2e` for the Playwright smoke suite.
- `scripts/devnet/full-demo.sh` — spins up an Anvil chain, deploys the stack, runs the lifecycle demo, and tails the Eyeion oracle in live mode (see `docs/runbooks/devnet.md`).
- `docs/runbooks/oracle-live.md` documents connecting the Eyeion oracle to a production Eklesia RPC.
- Deploy scripts (`script/*.s.sol`) expect role keys in env vars (see comments inline) and Foundry `--broadcast` usage.

## Coding Style & Naming Conventions
- Solidity follows OZ style: 4-space indentation, explicit errors, and role constants sourced from `utils/Roles.sol`.
- Frontend uses TypeScript strict mode, Tailwind utility classes, and violet “Cinematic Sovereign” gradients; colocate hooks with contract abstractions.
- Node services are ES modules with `viem` helpers; prefer async/await with exponential back-off for all external calls.
- Keep `.env.example` files current (root services and frontend expose `NEXT_PUBLIC_*` vars only when safe). Active WalletConnect/wagmi advisories are tracked in `docs/security/wagmi.md`; migration plan lives in `docs/architecture/wagmi-v2-migration.md`.

## Testing & Quality Gates
- Foundry tests live in `test/*.t.sol`; cover lifecycle happy paths, access control, KYC proofs, oracle events, and governance timelock execution.
- Python `pytest` retains 85%+ coverage for orchestration utilities in `src/`.
- Frontend leans on contract guarantees; add React Testing Library harnesses before beta launch.
- Log new external dependencies or seed data requirements in `docs/` prior to merge.

## Commit & Pull Request Expectations
- Conventional Commits with detail (`feat: wire se7en automation bridge`). Link on-chain governance proposals or Eyeion records where relevant.
- PRs must enumerate tests run (`forge test`, `make frontend` etc.) and surface remaining risks.
- Capture screenshots/gifs for UI updates and include explorer or IPFS links for oracle work.
