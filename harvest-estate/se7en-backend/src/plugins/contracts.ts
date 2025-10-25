import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import {
  type ContractsGateway,
  createContractsGateway,
  loadContractsConfigFromEnv,
} from '../lib/contracts.js';

declare module 'fastify' {
  interface FastifyInstance {
    contracts: ContractsGateway;
  }
}

export default fp(async (app: FastifyInstance) => {
  if (app.hasDecorator('contracts')) {
    return;
  }

  const config = loadContractsConfigFromEnv();
  const gateway = createContractsGateway(config);
  app.decorate('contracts', gateway);
});
