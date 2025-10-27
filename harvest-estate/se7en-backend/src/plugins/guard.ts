import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import {
  collectMissingInputs,
  updateEvidenceDoc,
  missingToTodoList,
  type MissingInput,
} from '../lib/requiredInputs.js';

type GuardState = {
  missingBase: MissingInput[];
  missingLive: MissingInput[];
  demoMode: boolean;
  liveMode: boolean;
  lastChecked: number;
};

declare module 'fastify' {
  interface FastifyInstance {
    ensurePreconditions(options?: { requireLiveReadiness?: boolean }): Promise<void>;
    reportMissingInputs(): GuardState;
  }
}

async function refreshState(): Promise<GuardState> {
  const snapshot = collectMissingInputs();
  await updateEvidenceDoc([...snapshot.base, ...snapshot.live]);
  return {
    missingBase: snapshot.base,
    missingLive: snapshot.live,
    demoMode: snapshot.demoMode,
    liveMode: snapshot.liveMode,
    lastChecked: Date.now(),
  };
}

export default fp(async function guardPlugin(app: FastifyInstance) {
  let state = await refreshState();

  const ensureFreshState = async () => {
    const ttlMs = 30_000;
    if (Date.now() - state.lastChecked > ttlMs) {
      state = await refreshState();
    }
    return state;
  };

  app.decorate('reportMissingInputs', () => state);

  app.decorate('ensurePreconditions', async (options?: { requireLiveReadiness?: boolean }) => {
    const requireLiveReadiness = options?.requireLiveReadiness ?? false;
    const snapshot = await ensureFreshState();

    if (snapshot.missingBase.length > 0) {
      const todo = missingToTodoList(snapshot.missingBase);
      const error: any = new Error('Required inputs missing for demo mode');
      error.statusCode = 428;
      error.todos = todo;
      throw error;
    }

    if (snapshot.liveMode && (requireLiveReadiness || snapshot.missingLive.length > 0)) {
      if (snapshot.missingLive.length > 0) {
        const todo = missingToTodoList(snapshot.missingLive);
        const error: any = new Error('LIVE_MODE active but inputs missing');
        error.statusCode = 428;
        error.todos = todo;
        throw error;
      }
    }

    if (requireLiveReadiness && snapshot.missingLive.length > 0) {
      const todo = missingToTodoList(snapshot.missingLive);
      const error: any = new Error('Live readiness inputs missing');
      error.statusCode = 428;
      error.todos = todo;
      throw error;
    }
  });

  app.addHook('onReady', async () => {
    state = await refreshState();
  });
});
