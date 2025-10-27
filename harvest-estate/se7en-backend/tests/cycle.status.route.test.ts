import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      cycle: {
        findUnique: vi.fn(),
        update: vi.fn(),
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

describe('PATCH /cycle/:id/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates cycle status to EXECUTED and logs audit trail', async () => {
    const contracts = createStubContracts();
    const app = buildApp({ contracts });
    const token = createJwt('TREASURY');

    const cycleFindMock = prisma.cycle.findUnique as unknown as Mock;
    cycleFindMock.mockResolvedValue({
      id: 'cycle-1',
      status: 'ARMED',
      noteId: 1n,
      cycleId: null,
      txHash: null,
      operator: null,
      metadata: {},
      executedAt: null,
    });

    const updatedRecord = {
      id: 'cycle-1',
      status: 'EXECUTED',
      noteId: 1n,
      cycleId: '0x' + 'c'.repeat(64),
      txHash: '0x' + 'd'.repeat(64),
      operator: '0x' + '1'.repeat(40),
      metadata: { manualUpdate: { actor: 'TREASURY', at: new Date().toISOString(), error: null } },
      executedAt: new Date(),
      failedAt: null,
    };

    const cycleUpdateMock = prisma.cycle.update as unknown as Mock;
    cycleUpdateMock.mockResolvedValue(updatedRecord);

    const auditCreateMock = prisma.auditLog.create as unknown as Mock;
    auditCreateMock.mockResolvedValue({
      id: 1,
      action: 'CYCLE_EXECUTE_MANUAL',
      assetId: 'manual-cycle-update',
      attestationId: null,
      txHash: updatedRecord.txHash,
      payload: {},
      createdAt: new Date(),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/cycle/cycle-1/status',
      payload: {
        status: 'EXECUTED',
        cycleId: updatedRecord.cycleId,
        txHash: updatedRecord.txHash,
        operator: updatedRecord.operator,
      },
      headers: { authorization: `Bearer ${token}`, 'x-test-role': 'TREASURY' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(body.cycle.status).toBe('EXECUTED');
    expect(body.cycle.failedAt).toBeNull();

    expect(cycleUpdateMock).toHaveBeenCalledTimes(1);
    const updateArgs = cycleUpdateMock.mock.calls[0][0];
    expect(updateArgs.where.id).toBe('cycle-1');
    expect(updateArgs.data.status).toBe('EXECUTED');
    expect(updateArgs.data.operator).toBe(updatedRecord.operator);
    expect(updateArgs.data.cycleId).toBe(updatedRecord.cycleId);
    expect(updateArgs.data.metadata.manualUpdate.actor).toBe('TREASURY');

    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    const auditArgs = auditCreateMock.mock.calls[0][0];
    expect(auditArgs.data.action).toBe('CYCLE_EXECUTE_MANUAL');
    expect(auditArgs.data.payload.status).toBe('EXECUTED');
    expect(auditArgs.data.payload.actor).toBe('TREASURY');

    await app.close();
  });

  it('rejects when cycle not found', async () => {
    const contracts = createStubContracts();
    const app = buildApp({ contracts });
    const token = createJwt('TREASURY');

    const cycleFindMock = prisma.cycle.findUnique as unknown as Mock;
    cycleFindMock.mockResolvedValue(null);

    const response = await app.inject({
      method: 'PATCH',
      url: '/cycle/missing-cycle/status',
      payload: { status: 'FAILED' },
      headers: { authorization: `Bearer ${token}`, 'x-test-role': 'TREASURY' },
    });

    expect(response.statusCode).toBe(404);
    const cycleUpdateMock = prisma.cycle.update as unknown as Mock;
    expect(cycleUpdateMock).not.toHaveBeenCalled();

    await app.close();
  });
});
