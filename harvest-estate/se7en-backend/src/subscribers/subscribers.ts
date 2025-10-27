import type { FastifyInstance } from 'fastify';
import { startCycleWatcher, type SubscriberController } from './cycleWatcher.js';

export async function startSubscribers(app: FastifyInstance): Promise<SubscriberController | undefined> {
  const controllers: SubscriberController[] = [];

  const cycleWatcher = startCycleWatcher(app, { contracts: (app as any).contracts });
  if (cycleWatcher) {
    controllers.push(cycleWatcher);
  } else {
    app.log.warn('Cycle watcher not started (disabled or misconfigured).');
  }

  if (controllers.length === 0) {
    app.log.warn('Gate A pending: Solana and Eklesia subscribers disabled until v3 pipeline implemented.');
    return undefined;
  }

  return {
    async stop() {
      await Promise.all(controllers.map((controller) => controller.stop()));
    },
  };
}

export function dedupeEvents<T extends { eventUid?: string }>(events: T[], seen: Set<string> = new Set()): T[] {
  const unique: T[] = [];
  for (const event of events) {
    const key = event.eventUid ?? JSON.stringify(event);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(event);
  }
  return unique;
}
