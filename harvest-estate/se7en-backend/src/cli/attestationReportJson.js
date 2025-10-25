import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { attestFile } from '../utils/attestFile.js';

export async function buildAttestationReport(options = {}) {
  const filePaths = Array.from(new Set(options.filePaths ?? [])).filter(Boolean);
  const prisma = options.prisma ?? new PrismaClient();
  const shouldDisconnect = !options.prisma;

  try {
    const rows = await prisma.attestationEvent.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const events = rows.map((row) => ({
      eventUid: row.eventUid,
      module: row.module,
      kind: row.kind,
      juraHash: row.juraHash,
      txHash: row.txHash ?? null,
      blockNumber: row.blockNumber ?? null,
      payload: (row.payload ?? {}),
      createdAt: row.createdAt.toISOString(),
    }));

    const files = await Promise.all(filePaths.map((filePath) => attestFile(filePath)));

    return {
      generatedAt: new Date().toISOString(),
      files,
      events,
    };
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

function parseArgs(argv) {
  const filePaths = [];
  let outputPath;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output' || arg === '-o') {
      outputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--output=')) {
      outputPath = arg.split('=', 2)[1];
      continue;
    }
    if (arg === '--files' || arg === '--file') {
      const value = argv[i + 1];
      if (value) {
        filePaths.push(...value.split(',').map((entry) => entry.trim()).filter(Boolean));
      }
      i += 1;
      continue;
    }
    if (arg.startsWith('--files=')) {
      const value = arg.split('=', 2)[1];
      filePaths.push(...value.split(',').map((entry) => entry.trim()).filter(Boolean));
      continue;
    }

    filePaths.push(arg);
  }

  return {
    filePaths: Array.from(new Set(filePaths.filter(Boolean))),
    outputPath,
  };
}

async function runFromCli(argv) {
  const { filePaths, outputPath } = parseArgs(argv);

  try {
    const report = await buildAttestationReport({ filePaths });
    const json = JSON.stringify(report, null, 2);

    if (outputPath) {
      const resolved = path.resolve(outputPath);
      await writeFile(resolved, `${json}\n`, 'utf8');
      process.stdout.write(`Attestation report written to ${resolved}\n`);
    } else {
      process.stdout.write(`${json}\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`attestationReportJson failed: ${message}\n`);
    process.exitCode = 1;
  }
}

const executedAsScript = (() => {
  const modulePath = fileURLToPath(import.meta.url);
  return modulePath === path.resolve(process.argv[1] ?? '');
})();

if (executedAsScript) {
  runFromCli(process.argv.slice(2));
}
