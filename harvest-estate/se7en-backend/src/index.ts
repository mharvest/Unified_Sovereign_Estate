import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import navRoutes from './routes/nav.js';
import redemptionRoutes from './routes/redemption.js';
import ledgerRoutes from './routes/ledger.js';

dotenv.config();

const mode = process.env.ESTATE_MODE ?? 'DEMO';
const port = Number(process.env.PORT ?? 4000);

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(navRoutes);
  await app.register(redemptionRoutes);
  await app.register(ledgerRoutes);

  if (mode === 'DEMO') {
    app.log.info('Running in DEMO Mode – Mock KMS Enabled');
  } else if (mode === 'LIVE') {
    app.log.info('Running in LIVE Mode – Secure Vault Integration Active');
  } else {
    app.log.warn({ mode }, 'Running in custom Estate mode');
  }

  try {
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Se7en backend ready on port ${port}`);
  } catch (err) {
    app.log.error(err, 'Failed to start Se7en backend');
    process.exit(1);
  }
}

main();
