import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/server.js';
import { createJwt, createSigningProviderStub, createStubContracts, MemoryAuditLogger, MemorySignatureStore } from './stubs.js';

const envelopePayload = {
  assetId: 'ASSET-123',
  type: 'STANDARD',
  recipients: [
    { name: 'Althea Chambers', email: 'law@harvest.estate', role: 'SIGNER' },
  ],
  documents: [
    { name: 'Affidavit', sha256: '0x' + 'a'.repeat(64) },
  ],
};

describe('signing routes', () => {
  const originalSignEnabled = process.env.SIGN_ENABLED;
  const store = new MemorySignatureStore();
  const provider = createSigningProviderStub();

  beforeEach(() => {
    process.env.SIGN_ENABLED = 'true';
  });

  afterEach(() => {
    process.env.SIGN_ENABLED = originalSignEnabled;
    store.envelopes.length = 0;
    store.events.length = 0;
  });

  it('returns 503 when signing is disabled', async () => {
    process.env.SIGN_ENABLED = 'false';
    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger(), signatureStore: store, signingProvider: provider });
    const token = createJwt('LAW');

    const res = await app.inject({
      method: 'POST',
      url: '/sign/envelope',
      payload: envelopePayload,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it('creates an envelope when enabled', async () => {
    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger(), signatureStore: store, signingProvider: provider });
    const token = createJwt('LAW');

    const res = await app.inject({
      method: 'POST',
      url: '/sign/envelope',
      payload: envelopePayload,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.envelopeId).toMatch(/^env_/);
    expect(store.envelopes).toHaveLength(1);
    expect(store.envelopes[0].status).toBe('SENT');
    await app.close();
  });

  it('rejects webhook with invalid signature when verifier is provided', async () => {
    const verifyingProvider = createSigningProviderStub({
      verifyWebhookSignature: () => false,
    });
    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger(), signatureStore: store, signingProvider: verifyingProvider });

    const res = await app.inject({
      method: 'POST',
      url: '/sign/webhook',
      payload: {
        envelopeId: 'env_test',
        status: 'COMPLETED',
        event: {
          eventId: 'evt_1',
          type: 'completed',
          occurredAt: new Date().toISOString(),
        },
      },
      headers: {
        'x-docusign-signature-1': 'invalid',
      },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('accepts webhook and records event when signature is valid', async () => {
    const payload = {
      envelopeId: 'env_valid',
      status: 'COMPLETED',
      signerEmail: 'law@harvest.estate',
      signedAt: new Date().toISOString(),
      event: {
        eventId: 'evt_2',
        type: 'completed',
        occurredAt: new Date().toISOString(),
      },
    };

    let expectedRaw = '';
    const verifyingProvider = createSigningProviderStub({
      verifyWebhookSignature: (rawBody) => rawBody === expectedRaw,
    });

    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger(), signatureStore: store, signingProvider: verifyingProvider });

    expectedRaw = JSON.stringify(payload);

    const res = await app.inject({
      method: 'POST',
      url: '/sign/webhook',
      payload,
      headers: {
        'content-type': 'application/json',
        'x-docusign-signature-1': 'valid',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(store.events).toHaveLength(1);
    expect(store.events[0].envelopeId).toBe('env_valid');
    expect(store.envelopes[0]?.status).toBe('COMPLETED');
    await app.close();
  });
});
