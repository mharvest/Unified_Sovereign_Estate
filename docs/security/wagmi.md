# WalletConnect & wagmi Advisory Tracking

## Context
- `wagmi@1.x` depends on WalletConnect v2 libraries that pull in `pino`→`fast-redact` and `ws@8.x`.
- `npm audit` flags `fast-redact` prototype pollution (GHSA-ffrw-9mx8-89p8) and `ws` DoS (GHSA-3h5v-q93c-6h6q).
- Upgrading wagmi beyond 1.x requires a breaking migration (hooks renamed, connectors refactored).

## Interim Mitigations
- Documented risk in `AGENTS.md` and here for SOC review.
- Frontend `.env.example` instructs operators to review dependencies before mainnet deploy.
- Oracle/front-end build scripts remain functional so we can iterate quickly toward an upgrade.

## Remediation Plan
1. Track wagmi v2 adoption (AppKit) and prepare a branch to migrate hooks (`useContractWrite` → `useWriteContract`, config overhaul).
2. Replace WalletConnect v2 peer with the AppKit SDK once governance approves.
3. After upgrading, re-run `npm audit` to confirm the dependency tree pulls `ws >= 8.18.0` and patched redact implementations.
4. Add CI `npm audit --omit=dev` gate once the dependency tree is clean.

## Operational Guidance
- Until upgrades land, restrict front-end usage to trusted operators.
- Review the advisory list during each release. If threat level increases, disable WalletConnect in production builds (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` empty) to shrink exposure.
- Re-run `npm install` and `npm audit` after every dependency change.
