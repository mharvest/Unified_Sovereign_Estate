import { createHash } from 'node:crypto';

export interface ActuarialClass {
  code: string;
  description: string;
  multiplier: number;
  floorBps: number;
  classCode: number;
}

interface ActuarialTables {
  version: string;
  source: string;
  classes: ActuarialClass[];
  disclosure: {
    jurisdiction: string;
    actuary: string;
    effectiveDate: string;
  };
}

const TABLES_JSON = `{
  "version": "2025-10-25",
  "source": "Matriarch Insurance Underwriting Desk",
  "classes": [
    {
      "code": "CSDN-A",
      "description": "Prime collateralized sovereign debt note",
      "multiplier": 3.5,
      "floorBps": 8500,
      "classCode": 1
    },
    {
      "code": "CSDN-B",
      "description": "Seasoned sovereign debt note",
      "multiplier": 2.8,
      "floorBps": 8000,
      "classCode": 2
    },
    {
      "code": "SDN-A",
      "description": "Secured digital note backed by insured real property",
      "multiplier": 2.1,
      "floorBps": 7200,
      "classCode": 3
    },
    {
      "code": "SDN-B",
      "description": "Stabilized digital note with partial collateral",
      "multiplier": 1.6,
      "floorBps": 6700,
      "classCode": 4
    }
  ],
  "disclosure": {
    "jurisdiction": "UHMI 508(c)(1)(a)",
    "actuary": "Matriarch Risk Collective",
    "effectiveDate": "2025-10-01"
  }
}`;

const TABLES: ActuarialTables = JSON.parse(TABLES_JSON) as ActuarialTables;

let verified = false;

function computeEmbeddedHash(): string {
  const hash = createHash('sha256');
  hash.update(TABLES_JSON);
  return hash.digest('hex');
}

export async function verifyActuarialHash(): Promise<void> {
  if (verified) {
    return;
  }
  const expected = process.env.ACTUARIAL_TABLES_JSON_SHA256;
  if (!expected) {
    throw new Error('ACTUARIAL_TABLES_JSON_SHA256 not configured');
  }
  const normalizedExpected = expected.startsWith('0x') ? expected.slice(2) : expected;
  const actual = computeEmbeddedHash();
  if (normalizedExpected.toLowerCase() !== actual) {
    throw new Error(`Actuarial tables hash mismatch (expected ${normalizedExpected}, found ${actual})`);
  }
  verified = true;
}

export async function resolveActuarialClass(classCode: number): Promise<ActuarialClass> {
  const entry = TABLES.classes.find((item) => item.classCode === classCode);
  if (!entry) {
    throw new Error(`Unknown actuarial class code: ${classCode}`);
  }
  return { ...entry };
}

export function listActuarialClasses(): ActuarialClass[] {
  return TABLES.classes.map((entry) => ({ ...entry }));
}
