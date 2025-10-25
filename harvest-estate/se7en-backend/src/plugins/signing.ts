import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createSigningProviderFromEnv, type SigningProvider } from '../signing/provider.js';
import { createPrismaSignatureStore, type SignatureStore } from '../signing/store.js';

export interface SigningContext {
  enabled: boolean;
  provider: SigningProvider;
  store: SignatureStore;
}

export interface SigningPluginOptions {
  store?: SignatureStore;
  provider?: SigningProvider;
}

declare module 'fastify' {
  interface FastifyInstance {
    signing: SigningContext;
  }
}

export default fp<SigningPluginOptions>(async function signingPlugin(app: FastifyInstance, options) {
  const provider = options.provider ?? createSigningProviderFromEnv();
  const store = options.store ?? createPrismaSignatureStore();

  const enabled = (process.env.SIGN_ENABLED ?? 'false').toLowerCase() === 'true';

  app.decorate('signing', {
    enabled,
    provider,
    store,
  });

  app.addHook('onClose', async () => {
    await store.close?.();
  });
});
