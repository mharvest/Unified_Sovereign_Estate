import { PrismaClient, Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { createPublicClient, defineChain, http, type Hex } from 'viem';
import { missingAddresses } from '../lib/addressGuard.js';
import { clients } from '../lib/contracts.js';
import { parseLogs, type ParsedEvent } from './parsers.js';

const SUBSCRIBER_NAME = 'core_ingestion_v1';
const DEFAULT_POLL_INTERVAL_MS = 5000;

export interface SubscriberController {
  stop: () => Promise<void>;
}

export async function startSubscribers(app: FastifyInstance): Promise<SubscriberController | undefined> {
  const contractsMode = (process.env.CONTRACTS_MODE ?? 'CHAIN').toUpperCase();
  if (contractsMode === 'STUB') {
    app.log.info('subscriber disabled in STUB contracts mode');
    return undefined;
  }
  if (process.env.SUBSCRIBER_ENABLED === 'false') {
    app.log.info('subscriber disabled via SUBSCRIBER_ENABLED flag');
    return undefined;
  }

  const missing = missingAddresses();
  if (missing.length > 0) {
    app.log.warn({ missing }, 'subscriber not started: contract addresses missing');
    return undefined;
  }

  const rpcUrl = process.env.SUBSCRIBER_RPC_URL ?? process.env.HARDHAT_RPC;
  if (!rpcUrl) {
    app.log.warn('subscriber not started: SUBSCRIBER_RPC_URL or HARDHAT_RPC not provided');
    return undefined;
  }

  const chainId = Number(process.env.CHAIN_ID ?? 31337);
  const chain = defineChain({
    id: chainId,
    name: 'sovereign-devnet',
    network: 'sovereign-devnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
  });

  const transport = http(rpcUrl, { timeout: 30_000 });
  const publicClient = createPublicClient({ chain, transport });
  const prisma = new PrismaClient();

  let cancelled = false;

  const addresses: Hex[] = Array.from(
    new Set(
      Object.values(clients)
        .filter((value): value is Hex => typeof value === 'string' && value !== 'missing')
        .map((value) => value as Hex),
    ),
  );

  if (addresses.length === 0) {
    app.log.warn('subscriber not started: no contract addresses configured');
    return undefined;
  }

  async function getCursor() {
    return prisma.subscriberCursor.upsert({
      where: { name: SUBSCRIBER_NAME },
      update: {},
      create: { name: SUBSCRIBER_NAME },
    });
  }

  async function writeEvents() {
    if (cancelled) return;
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const cursor = await getCursor();
      const fromBlock = BigInt(cursor.lastBlock);
      if (latestBlock <= fromBlock) {
        return;
      }

      const parsed = await parseLogs(publicClient, fromBlock + 1n, latestBlock, addresses);
      const events = dedupeEvents(parsed);
      for (const event of events) {
        try {
          await prisma.attestationEvent.create({
            data: {
              eventUid: event.eventUid,
              module: event.module,
              kind: event.kind,
              juraHash: event.juraHash,
              txHash: event.txHash ?? null,
              blockNumber: event.blockNumber ?? null,
              payload: event.payload,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            // duplicate, ignore
            continue;
          }
          app.log.error({ err: error, eventUid: event.eventUid }, 'failed to persist attestation event');
        }
      }

      await prisma.subscriberCursor.update({
        where: { name: SUBSCRIBER_NAME },
        data: { lastBlock: Number(latestBlock) },
      });
    } catch (error) {
      app.log.error({ err: error }, 'subscriber poll failed');
    }
  }

  let timer: NodeJS.Timeout | undefined;

  const schedule = () => {
    if (cancelled) return;
    timer = setTimeout(async () => {
      await writeEvents();
      schedule();
    }, DEFAULT_POLL_INTERVAL_MS);
  };

  await writeEvents();
  schedule();

  return {
    stop: async () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
      await prisma.$disconnect();
    },
  };
}

export function dedupeEvents(events: ParsedEvent[], seen: Set<string> = new Set()): ParsedEvent[] {
  const unique: ParsedEvent[] = [];
  for (const event of events) {
    if (seen.has(event.eventUid)) continue;
    seen.add(event.eventUid);
    unique.push(event);
  }
  return unique;
}
