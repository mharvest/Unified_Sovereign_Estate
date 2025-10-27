import { describe, expect, it, vi, beforeEach } from 'vitest';
import { reconcileCycles } from '../src/subscribers/cycleWatcher.js';
import * as parsers from '../src/subscribers/parsers.js';

describe('reconcileCycles', () => {
  const parseLogsMock = vi.spyOn(parsers, 'parseLogs');

  beforeEach(() => {
    vi.clearAllMocks();
    parseLogsMock.mockReset();
  });

  it('applies on-chain cycle execution events and records metadata', async () => {
    const cursorState: { lastBlock: bigint } = { lastBlock: 0n };
    const prismaStub = {
      cycle: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'cycle-1',
          status: 'ARMED',
          noteId: 1n,
          cycleId: null,
          tenorDays: 30,
          rateBps: 200,
          operator: null,
          txHash: null,
          metadata: {},
        }),
        update: vi.fn().mockImplementation(({ data }: any) => ({
          id: 'cycle-1',
          status: data.status,
          noteId: 1n,
          cycleId: data.cycleId,
          tenorDays: 30,
          rateBps: 200,
          operator: data.operator,
          txHash: data.txHash,
          metadata: data.metadata,
        })),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      attestationEvent: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      subscriberCursor: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(() => {
          cursorState.lastBlock = 0n;
          return { name: 'cycle_watcher', lastBlock: cursorState.lastBlock };
        }),
        upsert: vi.fn().mockImplementation(({ update, create }: any) => {
          cursorState.lastBlock = update?.lastBlock ?? create.lastBlock;
          return { name: 'cycle_watcher', lastBlock: cursorState.lastBlock };
        }),
      },
    } as any;

    const publicClientStub = {
      getBlockNumber: vi.fn().mockResolvedValue(12n),
    };

    const contractsStub = {
      getNote: vi.fn().mockResolvedValue({
        assetId: '0xasset',
        instrumentType: 1n,
        par: 1_000n,
        nav: 1_050n,
        affidavitId: '0xaff',
        attestationId: '0xatt',
        active: true,
      }),
    };

    parseLogsMock.mockResolvedValue([
      {
        eventUid: '0xabc:0',
        module: 'kiiantu',
        kind: 'CycleRun',
        juraHash: '0xhash',
        txHash: '0x' + '1'.repeat(64),
        blockNumber: 12,
        payload: {
          cycleId: '0x' + 'c'.repeat(64),
          noteId: '1',
        },
      },
    ]);

    const result = await reconcileCycles({
      prismaClient: prismaStub,
      publicClient: publicClientStub as any,
      contracts: contractsStub as any,
      kiiantuAddress: ('0x' + 'a'.repeat(40)) as `0x${string}`,
      now: new Date('2025-10-27T18:00:00.000Z'),
    });

    expect(result).toBe(1);
    expect(publicClientStub.getBlockNumber).toHaveBeenCalledTimes(1);
    expect(parseLogsMock).toHaveBeenCalledWith(publicClientStub, 1n, 12n, [expect.any(String)]);
    expect(prismaStub.cycle.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaStub.cycle.update).toHaveBeenCalledTimes(1);
    expect(prismaStub.cycle.update.mock.calls[0][0].data.status).toBe('EXECUTED');
    expect(prismaStub.cycle.update.mock.calls[0][0].data.metadata.onChainUpdate.txHash).toMatch(/^0x/);

    expect(prismaStub.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaStub.auditLog.create.mock.calls[0][0].data.payload.status).toBe('EXECUTED');

    expect(prismaStub.attestationEvent.create).toHaveBeenCalledTimes(1);
    const attestationPayload = prismaStub.attestationEvent.create.mock.calls[0][0].data.payload;
    expect(attestationPayload.note).toMatchObject({
      assetId: '0xasset',
      instrumentType: '1',
      par: '1000',
      nav: '1050',
    });

    expect(cursorState.lastBlock).toBe(12n);
  });

  it('updates cursor even when no events are found', async () => {
    const prismaStub = {
      subscriberCursor: {
        findUnique: vi.fn().mockResolvedValue({ name: 'cycle_watcher', lastBlock: 5n }),
        upsert: vi.fn().mockResolvedValue(undefined),
      },
    } as any;

    const publicClientStub = {
      getBlockNumber: vi.fn().mockResolvedValue(6n),
    };

    parseLogsMock.mockResolvedValue([]);

    const result = await reconcileCycles({
      prismaClient: prismaStub,
      publicClient: publicClientStub as any,
      kiiantuAddress: ('0x' + 'a'.repeat(40)) as `0x${string}`,
    });

    expect(result).toBe(0);
    expect(prismaStub.subscriberCursor.upsert).toHaveBeenCalledTimes(1);
  });
});
