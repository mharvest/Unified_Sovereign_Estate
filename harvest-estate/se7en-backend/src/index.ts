import dotenv from 'dotenv';
import { buildApp } from './server.js';
import { startSubscribers } from './subscribers/subscribers.js';
import { createStubGateway } from './lib/contractsStub.js';

dotenv.config();

const mode = process.env.ESTATE_MODE ?? 'DEMO';
const port = Number(process.env.PORT ?? 4000);
const contractsMode = (process.env.CONTRACTS_MODE ?? 'CHAIN').toUpperCase();

async function main() {
  const contracts =
    contractsMode === 'STUB'
      ? createStubGateway()
      : undefined;

  const app = buildApp({ contracts });
  let subscriberController = await startSubscribers(app);

  if (mode === 'DEMO') {
    app.log.info('Running in DEMO Mode – Mock KMS Enabled');
  } else if (mode === 'LIVE') {
    app.log.info('Running in LIVE Mode – Secure Vault Integration Active');
  } else {
    app.log.warn({ mode }, 'Running in custom Estate mode');
  }

  if (contractsMode === 'STUB') {
    app.log.info('Contracts gateway running in STUB mode – on-chain interactions mocked');
  }

  try {
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Se7en backend ready on port ${port}`);
  } catch (err) {
    app.log.error(err, 'Failed to start Se7en backend');
    if (subscriberController) {
      await subscriberController.stop();
    }
    process.exit(1);
  }

  const shutdown = async () => {
    try {
      await app.close();
    } catch (error) {
      app.log.error(error, 'Failed to close Fastify app');
    }
    if (subscriberController) {
      await subscriberController.stop();
      subscriberController = undefined;
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
