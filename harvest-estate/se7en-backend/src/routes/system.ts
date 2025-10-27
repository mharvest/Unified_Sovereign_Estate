import type { FastifyInstance } from 'fastify';
import { collectMissingInputs, missingToTodoList } from '../lib/requiredInputs.js';

export default async function systemRoutes(app: FastifyInstance) {
  app.get('/health/system', async (request, reply) => {
    const snapshot = collectMissingInputs();
    const todos = missingToTodoList([...snapshot.base, ...snapshot.live]);
    return reply.status(200).send({
      ok: snapshot.base.length === 0 && snapshot.live.length === 0,
      demoMode: snapshot.demoMode,
      liveMode: snapshot.liveMode,
      missingBase: snapshot.base,
      missingLive: snapshot.live,
      todos,
    });
  });

  app.get('/kpis', async (_request, reply) => {
    const snapshot = collectMissingInputs();
    const todos = missingToTodoList([...snapshot.base, ...snapshot.live]);
    return reply.status(503).send({
      ok: false,
      error: 'pending_oracle_bootstrap',
      todos,
      message: 'NAV oracle and cycle engines not initialised — see docs/needed-evidence.md',
    });
  });
}
