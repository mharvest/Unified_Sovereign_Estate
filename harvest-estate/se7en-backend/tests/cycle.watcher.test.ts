import { describe, expect, it, vi } from 'vitest';
import { reconcileCycles } from '../src/subscribers/cycleWatcher.js';

describe('reconcileCycles', () => {
  it('marks armed cycles as executed, creates audit and attestation rows', async () => {
    const cycles = [
      {
        id: 'cycle-1',
        status: 'ARMED',
        noteId: 1n,
        cycleId: '0x' + 'a'.repeat(64),
        tenorDays: 30,
        rateBps: 250,
        operator: '0x' + '1'.repeat(40),
        txHash: '0x' + 'b'.repeat(64),
        metadata: { previous: true },
        executedAt: null,
        failedAt: null,
      },
    ];

    const updates: any[] = [];
    const auditRecords: any[] = [];
    const attestationRecords: any[] = [];

    const prismaStub = {
      cycle: {
        findMany: vi.fn().mockResolvedValue(cycles),
        update: vi.fn().mockImplementation((input: any) => {
          updates.push(input);
          return {
            ...cycles[0],
            ...input.data,
          };
        }),
      },
      auditLog: {
        create: vi.fn().mockImplementation((input: any) => {
          auditRecords.push(input);
          return input;
        }),
      },
      attestationEvent: {
        create: vi.fn().mockImplementation((input: any) => {
          attestationRecords.push(input);
          return input;
        }),
      },
    } as any;

    const result = await reconcileCycles({
      prismaClient: prismaStub,
      now: new Date('2025-10-27T18:00:00.000Z'),
    });

    expect(result).toBe(1);
    expect(prismaStub.cycle.findMany).toHaveBeenCalledTimes(1);
    expect(prismaStub.cycle.update).toHaveBeenCalledTimes(1);
    expect(updates[0].where.id).toBe('cycle-1');
    expect(updates[0].data.status).toBe('EXECUTED');
    expect(updates[0].data.executedAt).toEqual(new Date('2025-10-27T18:00:00.000Z'));
    expect(updates[0].data.metadata.autoUpdate.at).toBe('2025-10-27T18:00:00.000Z');

    expect(auditRecords).toHaveLength(1);
    expect(auditRecords[0].data.action).toBe('CYCLE_EXECUTE_AUTO');
    expect(auditRecords[0].data.payload.cycleId).toBe('cycle-1');

    expect(attestationRecords).toHaveLength(1);
    expect(attestationRecords[0].data.eventType).toBe('CycleExecutedAuto');
    expect(attestationRecords[0].data.payload.cycleId).toBe(cycles[0].cycleId);
  });

  it('returns zero when no cycles pending', async () => {
    const prismaStub = {
      cycle: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await reconcileCycles({ prismaClient: prismaStub });
    expect(result).toBe(0);
    expect(prismaStub.cycle.findMany).toHaveBeenCalledTimes(1);
  });
});
