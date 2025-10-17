# Eyeion Oracle Live Integration

This guide connects the Eyeion Node service to a real Eklesia RPC and production Eyeion endpoint.

## Prerequisites
- Access to an Eklesia RPC endpoint (`https://rpc.eklesia.sov` or wss equivalent).
- Contract addresses for HRVST, CSDNInstrument, and KYC router deployed on that network.
- Eyeion API credentials (base URL + auth headers if required).
- SafeVault cache location on disk with read/write permissions.

## Environment
Create `services/eyeion-oracle/.env` with:
```ini
RPC_URL=https://rpc.eklesia.sov
CHAIN_ID=777
CSDN_ADDRESS=0x...
ROUTER_ADDRESS=0x...
SAFEVAULT_CACHE_PATH=/var/eyeion/cache/safevault-cache.json
EYEION_API_BASE=https://eyeion.harvest.sov/api
ORACLE_OFFLINE=false
```

Optional overrides:
- `FETCH_CONCURRENCY` to limit simultaneous POSTs.
- `SAFEVAULT_CACHE_PATH` should point to a persistent volume to survive restarts.

## Running
```bash
cd services/eyeion-oracle
npm install --production
node index.js
```
Logs will show each contract event with the IPFS mock CID. Replace `pinToIpfs` with an actual IPFS uploader and inject credentials via environment variables when ready.

## Deployment Notes
- Run behind a process manager (PM2/systemd) with auto-restart.
- Mount `/var/eyeion/logs` and `/var/eyeion/cache` for log rotation + SafeVault persistence.
- Reverse proxy the Eyeion API if outbound traffic must traverse a gateway.

## Troubleshooting
- `Missing required env vars` → verify `.env` and exported values.
- `fetch failed` → Eyeion endpoint unreachable; inspect network firewall.
- `Do not know how to serialize a BigInt` → ensure you are on the latest oracle build with BigInt normalization.
