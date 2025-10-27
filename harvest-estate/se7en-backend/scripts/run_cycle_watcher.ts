import 'dotenv/config';
import { defineChain, createPublicClient, http, type Hex } from 'viem';
import { prisma } from '../src/lib/prisma.js';
import { loadContractsConfigFromEnv, createContractsGateway } from '../src/lib/contracts.js';
import { reconcileCycles } from '../src/subscribers/cycleWatcher.js';

async function main() {
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

  const beforeCursor = await prisma.subscriberCursor.findUnique({ where: { name: 'cycle_watcher' } });
  const beforeCount = await prisma.attestationEvent.count({
    where: { eventType: 'CycleExecutedAuto' },
  });

  const updated = await reconcileCycles({
    prismaClient: prisma,
    publicClient,
    contracts,
    kiiantuAddress,
  });

  const afterCursor = await prisma.subscriberCursor.findUnique({ where: { name: 'cycle_watcher' } });
  const afterCount = await prisma.attestationEvent.count({
    where: { eventType: 'CycleExecutedAuto' },
  });

  const latestAttestation = await prisma.attestationEvent.findFirst({
    where: { eventType: 'CycleExecutedAuto' },
    orderBy: { createdAt: 'desc' },
  });

  console.table([
    {
      metric: 'cycles_updated',
      value: updated,
    },
    {
      metric: 'cursor_before',
      value: beforeCursor?.lastBlock?.toString() ?? 'null',
    },
    {
      metric: 'cursor_after',
      value: afterCursor?.lastBlock?.toString() ?? 'null',
    },
    {
      metric: 'attestations_before',
      value: beforeCount,
    },
    {
      metric: 'attestations_after',
      value: afterCount,
    },
  ]);

  if (latestAttestation) {
    console.log('Latest CycleExecutedAuto payload:', latestAttestation.payload);
  } else {
    console.log('No CycleExecutedAuto attestation events recorded yet.');
  }
}

main()
  .catch((error) => {
    console.error('Cycle watcher run failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
