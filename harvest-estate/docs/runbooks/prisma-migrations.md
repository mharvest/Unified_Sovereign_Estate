## Prisma Migration Runbook

**Updated:** 2025-10-21  
**Scope:** Se7en backend attestation/custody/signature schema (`prisma/schema.prisma`)

### Latest Migration
- Folder: `se7en-backend/prisma/migrations/20251021205344_attestation_events/`
- Adds the attestation event log, custody document tracking, signature envelopes/events, and supporting core ledger tables.

### One-Time Setup
1. Ensure `DATABASE_URL` points at the correct Postgres instance.
2. From `se7en-backend/` run:
   ```bash
   npx prisma generate
   ```

### Deploying To An Environment
```bash
cd se7en-backend
npx prisma migrate deploy --schema prisma/schema.prisma
```
- Use this for any shared environment (dev, staging, prod). It is idempotent and only applies pending migrations.

### Local Reset / Fresh DB
```bash
npx prisma migrate reset --force --skip-seed
```
- Recreates the schema locally without re-running demo seed flows. Run `npm run demo-seed` afterwards if you need demo data.

### CI / Sanity Check
- A new npm script wraps the two critical checks:
  ```bash
  npm run migration:verify
  ```
- Internally this performs:
  1. `prisma migrate deploy --schema prisma/schema.prisma`
  2. `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
- Use this in pipelines or before shipping to ensure the Prisma models and SQL migrations stay in sync.

### Rollback Strategy
- Rollbacks should be handled with a forward migration. If you need to undo changes locally, drop the database (`psql DROP DATABASE`) and re-run `npx prisma migrate reset`.

