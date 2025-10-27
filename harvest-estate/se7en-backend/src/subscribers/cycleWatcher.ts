import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { PublicClient, Hex } from 'viem';
import { createPublicClient, defineChain, http } from 'viem';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import {
  createContractsGateway,
  loadContractsConfigFromEnv,
  type ContractsGateway,
} from '../lib/contracts.js';
import { parseLogs, type ParsedEvent } from './parsers.js';

const CURSOR_NAME = 'cycle_watcher';

const DEFAULT_INTERVAL_MS = Number(process.env.CYCLE_WATCH_INTERVAL_MS ?? 30_000);
const NETWORK_NAME = process.env.CHAIN_NETWORK ?? process.env.CHAIN_NAME ?? 'unknown';
const LOOKBACK_BLOCKS = BigInt(process.env.CYCLE_WATCH_LOOKBACK_BLOCKS ?? '1024');

export interface CycleWatcherOptions {
  intervalMs?: number;
  prismaClient?: PrismaClient;
  logger?: FastifyBaseLogger;
  publicClient?: PublicClient;
  contracts?: ContractsGateway;
  kiiantuAddress?: Hex;
}

export async function reconcileCycles({
  prismaClient = defaultPrisma,
  logger = console as unknown as FastifyBaseLogger,
  publicClient,
  contracts,
  kiiantuAddress,
  now = new Date(),
}: {
  prismaClient?: PrismaClient;
  logger?: FastifyBaseLogger;
  publicClient?: PublicClient;
  contracts?: ContractsGateway;
  kiiantuAddress?: Hex;
  now?: Date;
} = {}): Promise<number> {
  if (!publicClient || !kiiantuAddress) {
    logger.warn('Cycle watcher requires public client and kiiantu address.');
    return 0;
  }

  const cursor = await getCursor(prismaClient);
  const latestBlock = await publicClient.getBlockNumber();
  let fromBlock = cursor.lastBlock + 1n;
  if (fromBlock > latestBlock) {
    return 0;
  }
  if (LOOKBACK_BLOCKS > 0n && latestBlock - fromBlock > LOOKBACK_BLOCKS) {
    fromBlock = latestBlock - LOOKBACK_BLOCKS;
  }
  const toBlock = latestBlock;

  const events = await parseLogs(publicClient, fromBlock, toBlock, [kiiantuAddress]);
  const cycleEvents = events.filter(
    (event) =>
      event.module === 'kiiantu' && ['CycleExecuted', 'CycleRun'].includes(event.kind),
  );

  let successes = 0;
  for (const event of cycleEvents) {
    try {
      const processed = await processCycleEvent(prismaClient, contracts, event, now);
      if (processed) {
        successes += 1;
      }
    } catch (error) {
      logger.warn({ err: error, eventUid: event.eventUid }, 'Failed to apply cycle execution event');
    }
  }

  await prismaClient.subscriberCursor.upsert({
    where: { name: CURSOR_NAME },
    update: { lastBlock: toBlock },
    create: { name: CURSOR_NAME, lastBlock: toBlock },
  });

  return successes;
}

export function startCycleWatcher(app: FastifyInstance, options: CycleWatcherOptions = {}): SubscriberController | undefined {
  const disabled = (process.env.CYCLE_WATCH_DISABLED ?? 'false').toLowerCase() === 'true';
  if (disabled) {
    app.log.info('Cycle watcher disabled via CYCLE_WATCH_DISABLED.');
    return undefined;
  }

  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const prismaClient = options.prismaClient ?? defaultPrisma;
  const logger = options.logger ?? app.log;

  let publicClient = options.publicClient;
  let contracts = options.contracts ?? (app as any).contracts;
  let kiiantuAddress = options.kiiantuAddress;

  if (!publicClient || !kiiantuAddress) {
    try {
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
      publicClient ??= createPublicClient({
        chain,
        transport: http(config.rpcUrl, { timeout: 120_000 }),
      });
      contracts ??= createContractsGateway(config);
      kiiantuAddress ??= config.addresses.kiiantu;
    } catch (error) {
      logger.warn({ err: error }, 'Cycle watcher could not initialise chain client; watcher disabled.');
      return undefined;
    }
  }

  let timer: NodeJS.Timer | undefined;
  const run = async () => {
    try {
      const updated = await reconcileCycles({
        prismaClient,
        logger,
        publicClient,
        contracts: contracts,
        kiiantuAddress,
      });
      if (updated > 0) {
        logger.info({ updated }, 'Cycle watcher reconciled executions.');
      }
    } catch (error) {
      logger.error({ err: error }, 'Cycle watcher iteration failed');
    }
  };

  timer = setInterval(run, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
  void run();

  return {
  stop: async () => {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    },
  };
}

export interface SubscriberController {
  stop: () => Promise<void>;
}

async function getCursor(prismaClient: PrismaClient) {
  const existing = await prismaClient.subscriberCursor.findUnique({ where: { name: CURSOR_NAME } });
  if (existing) {
    return existing;
  }
  return prismaClient.subscriberCursor.create({ data: { name: CURSOR_NAME, lastBlock: 0n } });
}

async function processCycleEvent(
  prismaClient: PrismaClient,
  contracts: ContractsGateway | undefined,
  event: ParsedEvent,
  fallbackDate: Date,
): Promise<boolean> {
  const payload = event.payload as Record<string, unknown>;
  const cycleHex = typeof payload.cycleId === 'string' ? payload.cycleId : null;
  const noteIdStr = typeof payload.noteId === 'string' ? payload.noteId : null;
  const noteId = noteIdStr ? BigInt(noteIdStr) : null;
  const operator = typeof payload.operator === 'string' ? payload.operator : undefined;
  const tenorDays = payload.tenorDays ? Number(payload.tenorDays) : undefined;
  const rateBps = payload.rateBps ? Number(payload.rateBps) : undefined;
  const timestampSeconds = payload.timestamp ? Number(payload.timestamp) : null;
  const executedAt = timestampSeconds ? new Date(timestampSeconds * 1000) : fallbackDate;

  const match = await findMatchingCycle(prismaClient, cycleHex, noteId);
  if (!match) {
    return false;
  }
  if (match.status === 'EXECUTED') {
    return false;
  }

  let noteDetails: ReturnType<typeof serializeNote> | null = null;
  if (contracts && noteId !== null) {
    try {
      const note = await contracts.getNote(noteId);
      noteDetails = serializeNote(note);
    } catch {
      noteDetails = null;
    }
  }

  const updated = await prismaClient.cycle.update({
    where: { id: match.id },
    data: {
      status: 'EXECUTED',
      cycleId: cycleHex ?? match.cycleId,
      txHash: event.txHash ?? match.txHash,
      operator: operator ?? match.operator,
      executedAt,
      failedAt: null,
      metadata: mergeMetadata(match.metadata, {
        onChainUpdate: {
          txHash: event.txHash,
          blockNumber: event.blockNumber ?? null,
          at: executedAt.toISOString(),
        },
      }),
    },
  });

  await prismaClient.auditLog.create({
    data: {
      action: 'CYCLE_EXECUTE_AUTO',
      assetId: updated.cycleId ?? 'auto-cycle-update',
      attestationId: null,
      txHash: updated.txHash,
      payload: {
        route: 'cycle_watcher',
        cycleId: updated.id,
        status: updated.status,
        noteId: updated.noteId.toString(),
        txHash: updated.txHash,
        operator: updated.operator,
        blockNumber: event.blockNumber ?? null,
      },
    },
  });

  await prismaClient.attestationEvent.create({
    data: {
      network: NETWORK_NAME,
      program: 'kiiantu',
      eventType: 'CycleExecutedAuto',
      txHash: updated.txHash ?? '',
      blockTime: executedAt,
      payload: {
        cycleId: updated.cycleId,
        noteId: updated.noteId.toString(),
        tenorDays: tenorDays ?? updated.tenorDays,
        rateBps: rateBps ?? updated.rateBps,
        operator: updated.operator,
        note: noteDetails,
      },
    },
  });

  return true;
}

async function findMatchingCycle(prismaClient: PrismaClient, cycleHex: string | null, noteId: bigint | null) {
  const ors: any[] = [];
  if (cycleHex) {
    ors.push({ cycleId: cycleHex });
  }
  if (noteId !== null) {
    ors.push({ noteId });
  }
  if (ors.length === 0) {
    return null;
  }
  return prismaClient.cycle.findFirst({
    where: {
      status: { not: 'EXECUTED' },
      OR: ors,
    },
    orderBy: { createdAt: 'desc' },
  });
}

function mergeMetadata(existing: unknown, patch: Record<string, unknown>) {
  if (existing && typeof existing === 'object') {
    return { ...(existing as Record<string, unknown>), ...patch };
  }
  return patch;
}

function serializeNote(note: Awaited<ReturnType<ContractsGateway['getNote']>>) {
  return {
    assetId: note.assetId,
    instrumentType: note.instrumentType.toString(),
    par: note.par.toString(),
    nav: note.nav.toString(),
    affidavitId: note.affidavitId,
    attestationId: note.attestationId,
    active: note.active,
  };
}
