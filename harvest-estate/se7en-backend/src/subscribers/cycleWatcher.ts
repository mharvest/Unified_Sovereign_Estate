import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import type { PrismaClient, Cycle } from '@prisma/client';
import { prisma as defaultPrisma } from '../lib/prisma.js';

const DEFAULT_INTERVAL_MS = Number(process.env.CYCLE_WATCH_INTERVAL_MS ?? 30_000);
const NETWORK_NAME = process.env.CHAIN_NETWORK ?? process.env.CHAIN_NAME ?? 'unknown';

export interface CycleWatcherOptions {
  intervalMs?: number;
  prismaClient?: PrismaClient;
  logger?: FastifyBaseLogger;
}

type CycleRecord = Cycle;

export async function reconcileCycles({
  prismaClient = defaultPrisma,
  logger = console as unknown as FastifyBaseLogger,
  now = new Date(),
}: {
  prismaClient?: PrismaClient;
  logger?: FastifyBaseLogger;
  now?: Date;
} = {}): Promise<number> {
  const cycles = await prismaClient.cycle.findMany({
    where: {
      status: 'ARMED',
      cycleId: { not: null },
    },
    take: 25,
  });

  if (cycles.length === 0) {
    return 0;
  }

  let successes = 0;
  for (const cycle of cycles) {
    try {
      await processCycle(prismaClient, cycle, now);
      successes += 1;
    } catch (error) {
      logger.warn({ err: error, cycleId: cycle.id }, 'Failed to reconcile cycle status');
    }
  }

  return successes;
}

async function processCycle(prismaClient: PrismaClient, cycle: CycleRecord, timestamp: Date) {
  const updated = await prismaClient.cycle.update({
    where: { id: cycle.id },
    data: {
      status: 'EXECUTED',
      executedAt: timestamp,
      failedAt: null,
      metadata: {
        ...(cycle.metadata ?? {}),
        autoUpdate: {
          at: timestamp.toISOString(),
        },
      },
    },
  });

  await prismaClient.auditLog.create({
    data: {
      action: 'CYCLE_EXECUTE_AUTO',
      assetId: 'auto-cycle-update',
      attestationId: null,
      txHash: updated.txHash,
      payload: {
        route: 'cycle_watcher',
        cycleId: updated.id,
        status: updated.status,
        noteId: updated.noteId.toString(),
        txHash: updated.txHash,
        operator: updated.operator,
      },
    },
  });

  await prismaClient.attestationEvent.create({
    data: {
      network: NETWORK_NAME,
      program: 'kiiantu',
      eventType: 'CycleExecutedAuto',
      txHash: updated.txHash ?? '',
      blockTime: timestamp,
      payload: {
        cycleId: updated.cycleId,
        noteId: updated.noteId.toString(),
        tenorDays: updated.tenorDays,
        rateBps: updated.rateBps,
        operator: updated.operator,
      },
    },
  });
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

  let timer: NodeJS.Timer | undefined;
  const run = async () => {
    try {
      const updated = await reconcileCycles({ prismaClient, logger });
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
