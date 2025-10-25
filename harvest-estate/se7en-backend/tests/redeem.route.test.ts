import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/server.js';
import { createJwt, createStubContracts, MemoryAuditLogger } from './stubs.js';

const NOTE_ASSET = ('0x' + 'c'.repeat(64)) as `0x${string}`;

describe('POST /redeem', () => {
  it('executes redemption certificate flow', async () => {
    const contracts = createStubContracts({
      async getNote(noteId) {
        return {
          assetId: NOTE_ASSET,
          instrumentType: 1n,
          par: 1_000n,
          nav: 1_000n,
          affidavitId: ('0x' + 'd'.repeat(64)) as `0x${string}`,
          attestationId: ('0x' + 'e'.repeat(64)) as `0x${string}`,
          active: true,
        };
      },
      async getAggregateNav() {
        return { navCsdn: 900n, navSdn: 0n };
      },
    });
    const audit = new MemoryAuditLogger();
    const app = buildApp({ contracts, audit });
    const token = createJwt('TREASURY');

    const res = await app.inject({
      method: 'POST',
      url: '/redeem',
      payload: {
        noteId: '1',
        amount: '100',
      },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.attestationId).toMatch(/^0x/);
    expect(body.nav.csdn).toBe('900');
    expect(audit.records.length).toBe(1);
    expect(audit.records[0].action).toBe('REDEMPTION');
    await app.close();
  });
});
