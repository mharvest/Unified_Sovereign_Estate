import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/server.js';
import { createJwt, createStubContracts, MemoryAuditLogger } from './stubs.js';

const DOC_HASH = ('0x' + 'b'.repeat(64)) as `0x${string}`;

describe('POST /mint', () => {
  it('rejects when custody is missing', async () => {
    const contracts = createStubContracts({
      async hasCustody() {
        return false;
      },
    });
    const audit = new MemoryAuditLogger();
    const app = buildApp({ contracts, audit });
    const token = createJwt('TREASURY');

    const res = await app.inject({
      method: 'POST',
      url: '/mint',
      payload: {
        instrument: 'CSDN',
        assetLabel: 'HASKINS-16315',
        par: '1000',
        affidavitId: DOC_HASH,
      },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(409);
    expect(audit.records.length).toBe(0);
    await app.close();
  });

  it('creates issuance attestation when gates pass', async () => {
    const contracts = createStubContracts({
      async hasCustody() {
        return true;
      },
      async latestAffidavit() {
        return DOC_HASH;
      },
      async animaOk() {
        return true;
      },
    });
    const audit = new MemoryAuditLogger();
    const app = buildApp({ contracts, audit });
    const token = createJwt('TREASURY');

    const res = await app.inject({
      method: 'POST',
      url: '/mint',
      payload: {
        instrument: 'CSDN',
        assetLabel: 'HASKINS-16315',
        par: '1000',
      },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.noteId).toBeDefined();
    expect(audit.records.length).toBe(1);
    expect(audit.records[0].action).toBe('ISSUANCE');
    await app.close();
  });
});
