# Local Devnet + Oracle Runbook

This guide demonstrates the complete fiduciary lifecycle on a local Anvil chain while the Eyeion oracle watches live events.

## Prerequisites
- Foundry installed (`foundryup`), npm available.
- No process bound to `127.0.0.1:8545`.

## One-Command Demo
```bash
./scripts/devnet/full-demo.sh
```

The script will:
1. Launch Anvil (chain id `777`, 10 funded accounts).
2. Deploy the full stack via `script/Deploy.s.sol` using keys from `scripts/devnet/anvil.env`.
3. Parse `broadcast/Deploy.s.sol/777/run-latest.json` to set env vars for subsequent scripts.
4. Start the Eyeion oracle in live mode and write mocked attestations to `services/eyeion-oracle/safevault-cache.json`.
5. Run the lifecycle scenario (`script/InsureSubscribeRedeemDemo.s.sol`) to originate, insure, subscribe, mark distribution, and redeem.
6. Stop the oracle and devnet when complete. Logs live in `.oracle.log` and `.anvil.log`.

## Customising Accounts
Duplicate `scripts/devnet/anvil.env` and edit addresses or salts. Pass the file via
```bash
ENV_FILE=path/to/custom.env ./scripts/devnet/full-demo.sh
```
Ensure every `*_KEY` maps to the intended derived address from the Anvil mnemonic (see the defaults in the env file).

## Oracle Verification
Inspect `services/eyeion-oracle/safevault-cache.json` or tail `.oracle.log` to confirm event replay (Originated → Issued → Insured → Subscribed → DistributionMarked → Redeemed).

## Cleanup
If the script exits unexpectedly, clean up with:
```bash
pkill -f "anvil --block-time" || true
rm -f .anvil.pid .oracle.pid .anvil.log .oracle.log
```
