import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { buildApp } from '../src/server.js';
import { createJwt, createStubContracts } from './stubs.js';
import { prisma } from '../src/lib/prisma.js';

describe('POST /issuance', () => {
  const token = createJwt('TREASURY');
  const auditCreateMock = prisma.auditLog.create as unknown as Mock;

  beforeEach(() => {
    auditCreateMock.mockReset();
  });

  it('returns 503 when the contracts gateway is unavailable', async () => {
    auditCreateMock.mockResolvedValue({ id: 'audit' });
    const contracts = {
      ...createStubContracts(),
      issueInstrument: undefined,
    } as any;

    const app = buildApp({ contracts });

    const response = await app.inject({
      method: 'POST',
      url: '/issuance',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        instrument: 'CSDN',
        assetLabel: 'HASKINS-16315',
        notionalUsd: '1000',
      },
    });

    expect(response.statusCode).toBe(503);
    expect(auditCreateMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('records issuance metadata when the contract call succeeds', async () => {
    auditCreateMock.mockResolvedValue({ id: 'audit-1' });
    const contracts = createStubContracts({
      async issueInstrument() {
        return {
          noteId: 42n,
          attestationId: '0xattestation',
          txHash: '0xtxhash',
        };
      },
    });

    const app = buildApp({ contracts });
    const response = await app.inject({
      method: 'POST',
      url: '/issuance',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        instrument: 'CSDN',
        assetLabel: 'HASKINS-16315',
        notionalUsd: '1000',
        notes: 'Initial issuance',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(body.noteId).toBe('42');
    expect(body.attestationId).toBe('0xattestation');
    expect(body.txHash).toBe('0xtxhash');

    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    const auditPayload = auditCreateMock.mock.calls[0][0];
    expect(auditPayload.data.action).toBe('ISSUANCE_ATTEMPT');
    expect(auditPayload.data.payload.result).toBe('ok');
    expect(auditPayload.data.payload.noteId).toBe('42');

    await app.close();
  });

  it('returns 502 and logs a warning when issuance fails', async () => {
    auditCreateMock.mockResolvedValue({ id: 'audit-2' });
    const contracts = createStubContracts({
      async issueInstrument() {
        throw new Error('oracle_unavailable');
      },
    });

    const app = buildApp({ contracts });
    const response = await app.inject({
      method: 'POST',
      url: '/issuance',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        instrument: 'CSDN',
        assetLabel: 'HASKINS-16315',
        notionalUsd: '1000',
      },
    });

    expect(response.statusCode).toBe(502);
    const body = response.json();
    expect(body.error).toBe('issuance_failed');
    expect(body.detail).toBe('oracle_unavailable');

    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    const auditPayload = auditCreateMock.mock.calls[0][0];
    expect(auditPayload.data.action).toBe('ISSUANCE_ATTEMPT_WITH_WARNING');
    expect(auditPayload.data.payload.result).toBe('warn');

    await app.close();
  });
});
