import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/server.js';
import { createJwt, createStubContracts, MemoryAuditLogger } from './stubs.js';

describe('POST /intake', () => {
  it('creates custody, affidavit, and attestation records', async () => {
    const audit = new MemoryAuditLogger();
    const contracts = createStubContracts();
    const localApp = buildApp({ contracts, audit });
    const token = createJwt('LAW');

    const res = await localApp.inject({
      method: 'POST',
      url: '/intake',
      payload: {
        assetLabel: 'HASKINS-16315',
        docs: [
          {
            type: 'APPRAISAL',
            hash: '0x' + 'a'.repeat(64),
          },
        ],
      },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.assetId).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(body.attestationId).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(audit.records.length).toBe(1);
    await localApp.close();
  });
});
