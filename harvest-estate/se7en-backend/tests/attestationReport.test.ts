import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { attestFile } from '../src/utils/attestFile.js';
import { buildAttestationReport } from '../src/cli/attestationReportJson.js';

describe('attestFile', () => {
  it('computes sha256 and metadata for a file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'attest-'));
    const filePath = path.join(dir, 'example.txt');
    const contents = 'harvest';
    await writeFile(filePath, contents, 'utf8');

    const hash = createHash('sha256').update(contents).digest('hex');
    const entry = await attestFile(filePath);

    expect(entry.fileName).toBe('example.txt');
    expect(entry.filePath).toBe(path.resolve(filePath));
    expect(entry.size).toBe(contents.length);
    expect(entry.sha256).toBe(`0x${hash}`);
    expect(new Date(entry.modifiedAt).getTime()).toBeGreaterThan(0);

    await rm(dir, { recursive: true, force: true });
  });
});

describe('buildAttestationReport', () => {
  it('returns attestation events and file ledger entries', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'report-'));
    const filePath = path.join(dir, 'artifact.json');
    await writeFile(filePath, '{"ok":true}', 'utf8');

    const prismaMock = {
      attestationEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            eventUid: 'tx1:0',
            module: 'eklesia',
            kind: 'Attested',
            juraHash: '0xabc',
            txHash: '0x123',
            blockNumber: 100,
            payload: { clause: 'INTAKE' },
            createdAt: new Date('2025-01-01T00:00:00Z'),
          },
        ]),
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const report = await buildAttestationReport({
      filePaths: [filePath],
      prisma: prismaMock as any,
    });

    expect(report.files).toHaveLength(1);
    expect(report.files[0].fileName).toBe('artifact.json');

    expect(report.events).toHaveLength(1);
    expect(report.events[0]).toMatchObject({
      module: 'eklesia',
      kind: 'Attested',
      payload: { clause: 'INTAKE' },
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    expect(typeof report.generatedAt).toBe('string');
    expect(new Date(report.generatedAt).getTime()).toBeGreaterThan(0);

    await rm(dir, { recursive: true, force: true });
  });

  it('propagates file errors with context', async () => {
    const prismaMock = {
      attestationEvent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      buildAttestationReport({
        filePaths: ['/no/such/file.txt'],
        prisma: prismaMock as any,
      }),
    ).rejects.toThrow(/no such file/i);
  });
});
