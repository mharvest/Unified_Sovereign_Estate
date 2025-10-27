import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      cycle: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

import { buildApp } from '../src/server.js';
import { createJwt, createStubContracts } from './stubs.js';
import { prisma } from '../src/lib/prisma.js';

const NOTE_ASSET = ('0x' + 'f'.repeat(64)) as `0x${string}`;
const CYCLE_ID = ('0x' + 'c'.repeat(64)) as `0x${string}`;
const TX_HASH = ('0x' + 'd'.repeat(64)) as `0x${string}`;

describe('POST /cycle/arm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs a cycle and records audit metadata', async () => {
    const contracts = createStubContracts({
      async getNote() {
        return {
          assetId: NOTE_ASSET,
          instrumentType: 1n,
          par: 1_000n,
          nav: 1_050n,
          affidavitId: NOTE_ASSET,
          attestationId: NOTE_ASSET,
          active: true,
        };
      },
      async runCycle(noteId, tenorDays, rateBps) {
        expect(noteId).toBe(1n);
        expect(tenorDays).toBe(30);
        expect(rateBps).toBe(250);
        return { cycleId: CYCLE_ID, txHash: TX_HASH };
      },
    } as any);

    const token = createJwt('TREASURY');
    const app = buildApp({ contracts });

    const cycleCreateMock = prisma.cycle.create as unknown as Mock;
    cycleCreateMock.mockResolvedValue({
      id: 'cycle-record-id',
    } as any);

    const auditCreateMock = prisma.auditLog.create as unknown as Mock;
    auditCreateMock.mockResolvedValue({
      id: 'audit-id',
      route: 'POST /cycle/arm',
      actor: null,
      result: 'ok',
      meta: {},
      createdAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/cycle/arm',
      payload: {
        noteId: '1',
        tenorDays: 30,
        rateBps: 250,
      },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.cycleId).toBe(CYCLE_ID);
    expect(body.txHash).toBe(TX_HASH);
    expect(body.assetId).toBe(NOTE_ASSET);

    expect(cycleCreateMock).toHaveBeenCalledTimes(1);
    const cyclePayload = cycleCreateMock.mock.calls[0][0];
    expect(cyclePayload.data.program).toBe('kiiantu');
    expect(cyclePayload.data.status).toBe('ARMED');
    expect(cyclePayload.data.noteId).toBe(1n);
    expect(cyclePayload.data.cycleId).toBe(CYCLE_ID);
    expect(cyclePayload.data.tenorDays).toBe(30);
    expect(cyclePayload.data.rateBps).toBe(250);
    expect(cyclePayload.data.operator).toBeDefined();
    expect(cyclePayload.data.txHash).toBe(TX_HASH);
    expect(cyclePayload.data.armedAt).toBeInstanceOf(Date);
    expect(cyclePayload.data.executedAt).toBeNull();
    expect(cyclePayload.data.failedAt).toBeNull();
    expect(cyclePayload.data.metadata).toMatchObject({
      cycleError: null,
    });

    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    const auditPayload = auditCreateMock.mock.calls[0][0];
    expect(auditPayload.data.action).toBe('CYCLE_ARM');
    expect(auditPayload.data.payload.cycleId).toBe(CYCLE_ID);
    expect(auditPayload.data.payload.status).toBe('ARMED');
    expect(auditPayload.data.payload.operator).toBeDefined();

    await app.close();
  });

  it('rejects inactive notes', async () => {
    const contracts = createStubContracts({
      async getNote() {
        return {
          assetId: NOTE_ASSET,
          instrumentType: 1n,
          par: 1_000n,
          nav: 1_000n,
          affidavitId: NOTE_ASSET,
          attestationId: NOTE_ASSET,
          active: false,
        };
      },
    });

    const token = createJwt('TREASURY');
    const app = buildApp({ contracts });

    const cycleCreateMock = prisma.cycle.create as unknown as Mock;
    const auditCreateMock = prisma.auditLog.create as unknown as Mock;

    const res = await app.inject({
      method: 'POST',
      url: '/cycle/arm',
      payload: {
        noteId: '1',
        tenorDays: 30,
        rateBps: 250,
      },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('note_inactive');

    expect(cycleCreateMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();

    await app.close();
  });
});
