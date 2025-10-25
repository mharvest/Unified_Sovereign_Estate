import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, type Hex } from 'viem';
import {
  EklesiaAttestorABI,
  SafeVaultABI,
} from '../src/abi/index.js';
import { parseLogs } from '../src/subscribers/parsers.js';
import { dedupeEvents } from '../src/subscribers/subscribers.js';
import { clients } from '../src/lib/contracts.js';

type MockPublicClient = {
  getLogs: ReturnType<typeof vi.fn>;
};

const originalClients = { ...clients };

beforeEach(() => {
  clients.eklesia = '0x0000000000000000000000000000000000000101' as Hex;
  clients.safevault = '0x0000000000000000000000000000000000000102' as Hex;
});

afterEach(() => {
  Object.assign(clients, originalClients);
});

describe('parseLogs', () => {
  it('decodes contract logs into attestation events', async () => {
    const attestedLog = makeLog(
      EklesiaAttestorABI,
      'Attested',
      {
        attestationId: '0x' + '1'.repeat(64),
        subjectId: '0x' + '2'.repeat(64),
        payloadHash: '0x' + '3'.repeat(64),
        jurisdiction: 'UHMI 508(c)(1)(a)',
        clause: 'INTAKE',
        timestamp: 1_720_000_000n,
        attestor: '0x' + '4'.repeat(40),
      },
      clients.eklesia as Hex,
      { logIndex: 0, txHash: '0x' + 'a'.repeat(64) },
    );

    const docStoredLog = makeLog(
      SafeVaultABI,
      'DocumentStored',
      {
        assetId: '0x' + '5'.repeat(64),
        docHash: '0x' + '6'.repeat(64),
        actor: '0x' + '7'.repeat(40),
      },
      clients.safevault as Hex,
      { logIndex: 1, txHash: '0x' + 'b'.repeat(64) },
    );

    const mockClient: MockPublicClient = {
      getLogs: vi.fn().mockResolvedValue([attestedLog, docStoredLog]),
    };

    const events = await parseLogs(
      mockClient as unknown as Parameters<typeof parseLogs>[0],
      1n,
      10n,
      [clients.eklesia as Hex, clients.safevault as Hex],
    );

    expect(events).toHaveLength(2);

    expect(events[0]).toMatchObject({
      module: 'eklesia',
      kind: 'Attested',
      juraHash: '0x' + '3'.repeat(64),
      payload: expect.objectContaining({
        attestationId: '0x' + '1'.repeat(64),
        clause: 'INTAKE',
      }),
    });

    expect(events[1]).toMatchObject({
      module: 'safevault',
      kind: 'DocumentStored',
      juraHash: '0x' + '6'.repeat(64),
      payload: expect.objectContaining({
        assetId: '0x' + '5'.repeat(64),
        docHash: '0x' + '6'.repeat(64),
      }),
    });
  });

  it('yields stable event ids so restarts do not create duplicates', async () => {
    const attestedLog = makeLog(
      EklesiaAttestorABI,
      'Attested',
      {
        attestationId: '0x' + '9'.repeat(64),
        subjectId: '0x' + '8'.repeat(64),
        payloadHash: '0x' + '7'.repeat(64),
        jurisdiction: 'UHMI 508(c)(1)(a)',
        clause: 'INSURANCE',
        timestamp: 1_720_100_000n,
        attestor: '0x' + '1'.repeat(40),
      },
      clients.eklesia as Hex,
      { logIndex: 0, txHash: '0x' + 'c'.repeat(64) },
    );

    const mockClient: MockPublicClient = {
      getLogs: vi.fn().mockResolvedValue([attestedLog]),
    };

    const seen = new Set<string>();

    const firstRun = await parseLogs(
      mockClient as unknown as Parameters<typeof parseLogs>[0],
      1n,
      2n,
      [clients.eklesia as Hex],
    );
    const firstInsert = dedupeEvents(firstRun, seen);
    expect(firstInsert).toHaveLength(1);

    const restartRun = await parseLogs(
      mockClient as unknown as Parameters<typeof parseLogs>[0],
      1n,
      2n,
      [clients.eklesia as Hex],
    );
    const restartInsert = dedupeEvents(restartRun, seen);
    expect(restartInsert).toHaveLength(0);
  });
});

function makeLog(
  abi: readonly any[],
  eventName: string,
  args: Record<string, unknown>,
  address: Hex,
  options: { blockNumber?: bigint; logIndex?: number; txHash?: string } = {},
) {
  const event = abi.find(
    (item: { type?: string; name?: string }) => item.type === 'event' && item.name === eventName,
  );
  if (!event) {
    throw new Error(`Event ${eventName} not found in ABI`);
  }

  const topics = encodeEventTopics({
    abi,
    eventName,
    args,
  });

  const nonIndexed = (event.inputs ?? []).filter((input: { indexed?: boolean }) => !input.indexed);
  const nonIndexedValues = nonIndexed.map((input: { name: string }) => args[input.name]);
  const data =
    nonIndexed.length > 0
      ? encodeAbiParameters(nonIndexed as any, nonIndexedValues as any)
      : '0x';

  return {
    address,
    topics,
    data,
    blockHash: '0x' + 'f'.repeat(64),
    blockNumber: options.blockNumber ?? 1n,
    logIndex: options.logIndex ?? 0,
    transactionHash: options.txHash ?? '0x' + 'e'.repeat(64),
    transactionIndex: 0,
    removed: false,
  };
}
