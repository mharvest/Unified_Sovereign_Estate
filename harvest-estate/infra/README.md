# Harvest Estate Infra

Utility assets for orchestrating the sovereign stack.

## Dockerfile
Builds a Node 20 base image with both frontend and backend dependencies installed. Invoke from the repository root:

```bash
docker build -f infra/Dockerfile .
```

## Scripts
- `scripts/init_db.sh` — applies Prisma migrations inside the Se7en service container.
- `scripts/seed_demo_data.ts` — seeds demo treasury balances and token supply.

Run the seed script via the provided Make target:

```bash
make seed-demo
```

The script expects the backend container to be running with database connectivity.
