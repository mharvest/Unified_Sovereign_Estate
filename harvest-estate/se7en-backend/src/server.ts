import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import contractsPlugin from './plugins/contracts.js';
import auditPlugin, { type AuditLogger } from './plugins/audit.js';
import authPlugin from './plugins/auth.js';
import signingPlugin from './plugins/signing.js';
import vaultPlugin from './plugins/vault.js';
import navRoutes from './routes/nav.js';
import redemptionRoutes from './routes/redemption.js';
import ledgerRoutes from './routes/ledger.js';
import intakeRoutes from './routes/intake.js';
import mintRoutes from './routes/mint.js';
import insuranceRoutes from './routes/insurance.js';
import circulateRoutes from './routes/circulate.js';
import redeemRoutes from './routes/redeem-orchestrator.js';
import verifyRoutes from './routes/verify.js';
import signRoutes from './routes/sign.js';
import vaultRoutes from './routes/vault.js';
import type { ContractsGateway } from './lib/contracts.js';
import { markClientsConfiguredForTests } from './lib/addressGuard.js';
import type { SignatureStore } from './signing/store.js';
import type { SigningProvider } from './signing/provider.js';
import type { VaultPluginOptions } from './plugins/vault.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export interface BuildAppOptions {
  contracts?: ContractsGateway;
  audit?: AuditLogger;
  signatureStore?: SignatureStore;
  signingProvider?: SigningProvider;
  vaultOptions?: VaultPluginOptions;
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
  app.register(vaultPlugin, options.vaultOptions);

  app.register(navRoutes);
  app.register(redemptionRoutes);
  app.register(ledgerRoutes);
  app.register(intakeRoutes);
  app.register(mintRoutes);
  app.register(insuranceRoutes);
  app.register(circulateRoutes);
  app.register(redeemRoutes);
  app.register(verifyRoutes);
  app.register(signRoutes);
  app.register(vaultRoutes);

  return app;
}
