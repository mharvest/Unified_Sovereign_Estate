import 'dotenv/config';
import { defineChain, createPublicClient, http, type Hex } from 'viem';
import { prisma } from '../src/lib/prisma.js';
import { loadContractsConfigFromEnv, createContractsGateway } from '../src/lib/contracts.js';
import { reconcileCycles } from '../src/subscribers/cycleWatcher.js';

const INTERVAL_MS = Number(process.env.CYCLE_WATCH_INTERVAL_MS ?? 60000);

async function runOnce() {
  const config = loadContractsConfigFromEnv();
  const chain = defineChain({
    id: config.chainId,
    name: 'sovereign-devnet',
    network: 'sovereign-devnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
      public: { http: [config.rpcUrl] },
    },
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl, { timeout: 120_000 }),
  });
  const contracts = createContractsGateway(config);
  const kiiantuAddress = config.addresses.kiiantu as Hex;

  const updated = await reconcileCycles({
    prismaClient: prisma,
    publicClient,
    contracts,
    kiiantuAddress,
  });

  if (updated > 0) {
    console.log(`[${new Date().toISOString()}] reconciled ${updated} cycles`);
  }
}

async function main() {
  await runOnce();
  setInterval(() => {
    runOnce().catch((error) => {
      console.error('Cycle watcher loop error', error);
    });
  }, INTERVAL_MS); // pm2 keeps the process alive
}

main().catch((error) => {
  console.error('Cycle watcher worker failed', error);
  process.exit(1);
});
