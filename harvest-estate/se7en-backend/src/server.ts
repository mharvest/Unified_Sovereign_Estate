import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import contractsPlugin from './plugins/contracts.js';
import auditPlugin, { type AuditLogger } from './plugins/audit.js';
import authPlugin from './plugins/auth.js';
import guardPlugin from './plugins/guard.js';
import vaultPlugin, { type VaultPluginOptions } from './plugins/vault.js';
import signingPlugin, { type SigningPluginOptions } from './plugins/signing.js';
import type { ContractsGateway } from './lib/contracts.js';
import { markClientsConfiguredForTests } from './lib/addressGuard.js';
import operationsRoutes from './routes/operations.js';
import systemRoutes from './routes/system.js';
import signRoutes from './routes/sign.js';
import ledgerRoutes from './routes/ledger.js';
import verifyRoutes from './routes/verify.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export interface BuildAppOptions {
  contracts?: ContractsGateway;
  audit?: AuditLogger;
  vaultOptions?: VaultPluginOptions;
  signatureStore?: SigningPluginOptions['store'];
  signingProvider?: SigningPluginOptions['provider'];
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    if (typeof body !== 'string') {
      done(null, body as unknown);
      return;
    }

    request.rawBody = body;
    try {
      const json = JSON.parse(body);
      done(null, json);
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.register(cors, { origin: true });

  if (options.contracts) {
    app.decorate('contracts', options.contracts);
    markClientsConfiguredForTests();
  }
  if (options.audit) {
    app.decorate('audit', options.audit);
  }

  if (!options.contracts) {
    app.register(contractsPlugin);
  }
  if (!options.audit) {
    app.register(auditPlugin);
  }

  app.register(authPlugin);
  app.register(signingPlugin, {
    store: options.signatureStore,
    provider: options.signingProvider,
  });
  app.register(vaultPlugin, options.vaultOptions ?? {});
  app.register(guardPlugin);

  app.register(systemRoutes);
  app.register(operationsRoutes);
  app.register(signRoutes);
  app.register(ledgerRoutes);
  app.register(verifyRoutes);

  return app;
}
