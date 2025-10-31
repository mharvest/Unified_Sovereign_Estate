import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface CoverageClass {
  code: string;
  description: string;
  multiplier: number;
  floorBps: number;
  classCode: number;
}

interface ActuarialTables {
  version: string;
  source: string;
  classes: CoverageClass[];
  disclosure: Record<string, unknown>;
}

interface LoadedTables {
  tables: ActuarialTables;
  hash: string;
  sourcePath: string;
}

let cachedTables: LoadedTables | null = null;

const DEFAULT_RELATIVE_PATHS = [
  ['docs', 'actuarial', 'matriarch_tables.json'],
  ['..', 'docs', 'actuarial', 'matriarch_tables.json'],
  ['..', '..', 'docs', 'actuarial', 'matriarch_tables.json'],
];

function normalizeHash(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/, '');
}

async function loadActuarialTables(): Promise<LoadedTables> {
  if (cachedTables) {
    return cachedTables;
  }

  const overrides: string[] = [];
  const searchPaths: string[] = [];

  if (process.env.ACTUARIAL_TABLES_PATH && process.env.ACTUARIAL_TABLES_PATH.trim().length > 0) {
    searchPaths.push(path.resolve(process.env.ACTUARIAL_TABLES_PATH.trim()));
    overrides.push(searchPaths[0]);
  }

  for (const parts of DEFAULT_RELATIVE_PATHS) {
    searchPaths.push(path.resolve(process.cwd(), ...parts));
  }

  const attempted: string[] = [];

  for (const candidate of searchPaths) {
    attempted.push(candidate);
    try {
      const raw = await readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw) as ActuarialTables;
      const hash = `0x${createHash('sha256').update(raw, 'utf8').digest('hex')}`;
      cachedTables = { tables: parsed, hash, sourcePath: candidate };
      return cachedTables;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'ENOENT') {
        continue;
      }
      throw new Error(`Failed to load actuarial tables from ${candidate}: ${err?.message ?? err}`);
    }
  }

  const overrideNotice = overrides.length > 0 ? ` (ACTUARIAL_TABLES_PATH=${overrides[0]})` : '';
  throw new Error(`Unable to locate actuarial tables${overrideNotice}. Checked: ${attempted.join(', ')}`);
}

export async function verifyActuarialHash(): Promise<void> {
  const expected = process.env.ACTUARIAL_TABLES_JSON_SHA256?.trim() ?? '';
  if (expected.length === 0) {
    throw new Error('ACTUARIAL_TABLES_JSON_SHA256 is not configured');
  }

  const { hash, sourcePath } = await loadActuarialTables();
  if (normalizeHash(expected) !== normalizeHash(hash)) {
    throw new Error(`Actuarial tables hash mismatch for ${sourcePath}. Expected ${expected}, found ${hash}`);
  }
}

export async function resolveActuarialClass(classCode: number): Promise<CoverageClass> {
  const { tables } = await loadActuarialTables();
  const coverageClass = tables.classes.find((item) => item.classCode === classCode);
  if (!coverageClass) {
    throw new Error(`Unknown Matriarch coverage class code: ${classCode}`);
  }
  return coverageClass;
}

