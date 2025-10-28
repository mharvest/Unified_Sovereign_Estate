import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/server.js';
import { createStubContracts, MemoryAuditLogger } from './stubs.js';

const ATTESTATION_ID = ('0x' + 'a'.repeat(64)) as `0x${string}`;

describe('GET /verify/:attestationId', () => {
  it('returns dossier JSON', async () => {
    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger() });

    const res = await app.inject({
      method: 'GET',
      url: `/verify/${ATTESTATION_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.attestation.id).toBe(ATTESTATION_ID);
    expect(typeof body.attestation.timestamp).toBe('string');
    expect(Array.isArray(body.safeVault.docHashes)).toBe(true);

    await app.close();
  });

  it('returns dossier PDF', async () => {
    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger() });

    const res = await app.inject({
      method: 'GET',
      url: `/verify/${ATTESTATION_ID}/pdf`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
    expect(res.rawPayload.length).toBeGreaterThan(0);

    await app.close();
  });

  it('returns 404 when attestation is missing', async () => {
    const app = buildApp({
      contracts: createStubContracts({
        async getAttestation() {
          return {
            subjectId: '0x0000000000000000000000000000000000000000000000000000000000000000',
            payloadHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            clause: '',
            timestamp: 0n,
            attestor: '0x0000000000000000000000000000000000000000',
          };
        },
      }),
      audit: new MemoryAuditLogger(),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/verify/${ATTESTATION_ID}`,
    });

    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
