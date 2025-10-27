# Cycle Watcher Ops

## Manual Execution
1. Ensure Hardhat/Anvil is running at http://127.0.0.1:8545.
2. Run `npx tsx scripts/run_cycle_once.ts` to simulate a cycle execution on note 1 (tenor 30, rate 250).
3. Reset the watcher cursor if you want to replay from genesis:
   ```bash
   npx tsx -e "(async () => { const { prisma } = await import('./src/lib/prisma.js'); await prisma.subscriberCursor.upsert({ where: { name: 'cycle_watcher' }, update: { lastBlock: 0n }, create: { name: 'cycle_watcher', lastBlock: 0n } }); await prisma.$disconnect(); })();"
   ```
4. Invoke the watcher to consume logs:
   ```bash
   make cycle-watcher
   # or npx tsx scripts/run_cycle_watcher.ts
   ```
5. Check the output table for `cycles_updated`, cursor advance, gas metrics, and attestation counts.
6. Inspect the latest attestation payload printed to confirm note metadata and block/gas data.

## Cron Setup
1. Make the cron helper executable:
   ```bash
   chmod +x scripts/run_cycle_watcher_cron.sh
   ```
2. Add an entry to your crontab (example runs every minute):
   ```bash
   * * * * * /path/to/repo/scripts/run_cycle_watcher_cron.sh
   ```
3. Logs are appended to `var/logs/cycle_watcher.log`.

## Useful Queries
- `SELECT "status", "cycleId", "executedAt" FROM "Cycle" WHERE "id" = 'cmh9d9mkl00007ut7y8zzgjhg';`
- `SELECT "eventType", "payload" FROM "AttestationEvent" WHERE "eventType" = 'CycleExecutedAuto' ORDER BY "createdAt" DESC LIMIT 1;`

## Notes
- The watcher now listens for `CycleRun` events and enriches attestation payloads with VaultQuant note data.
- Update the cursor only if you intend to replay past logs; otherwise the watcher maintains its position automatically.
