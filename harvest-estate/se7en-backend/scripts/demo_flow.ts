#!/usr/bin/env tsx
import { setTimeout as wait } from 'node:timers/promises';

const BASE_URL = process.env.SE7EN_BASE_URL ?? 'http://localhost:4000';
const TOKENS = {
  intake: process.env.SE7EN_DEMO_JWT_LAW ?? process.env.SE7EN_DEMO_JWT,
  insurance: process.env.SE7EN_DEMO_JWT_INSURANCE ?? process.env.SE7EN_DEMO_JWT,
  mint: process.env.SE7EN_DEMO_JWT_TREASURY ?? process.env.SE7EN_DEMO_JWT,
  circulate: process.env.SE7EN_DEMO_JWT_TREASURY ?? process.env.SE7EN_DEMO_JWT,
  redeem: process.env.SE7EN_DEMO_JWT_TREASURY ?? process.env.SE7EN_DEMO_JWT,
  sign: process.env.SE7EN_DEMO_JWT_LAW ?? process.env.SE7EN_DEMO_JWT,
  upload: process.env.SE7EN_DEMO_JWT_OPS ?? process.env.SE7EN_DEMO_JWT,
};
const UPLOAD_FLAG =
  (process.env.SAFEVAULT_UPLOADS_ENABLED ?? process.env.UPLOADS_ENABLED ?? 'false').toLowerCase() === 'true';

if (!TOKENS.intake) {
  throw new Error('SE7EN_DEMO_JWT (or role-specific tokens) must be set to run the demo flow');
}

interface StepResult {
  name: string;
  status: 'ok' | 'skipped' | 'error';
  detail?: string;
  attestationId?: string;
}

interface FlowResult {
  asset: string;
  steps: StepResult[];
}

function requireToken(name: keyof typeof TOKENS): string {
  const token = TOKENS[name];
  if (!token) {
    throw new Error(`missing_token_${name}`);
  }
  return token;
}

async function post(path: string, payload: unknown, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const contentType = res.headers.get('content-type');
  const data = contentType && contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(typeof data === 'string' ? data : data?.error ?? 'unknown_error');
  }
  return data;
}

const HASKINS_DOCS = [
  {
    type: 'APPRAISAL',
    hash: '0x721a90229d9d7d1899a75be9cfe6ea5e12a57cc1df4c92b6cf7ad79f0e1f58c7',
  },
  {
    type: 'TITLE/DEED',
    hash: '0x95817b41c98d36d864dbd31a73dec110f9701ce602757754f2300bc64a90f1c6',
  },
  {
    type: 'PAYOFF',
    hash: '0x3f731c6dca8535f6fcc61ab58f1395cce6aae1ec5d0d26e4eb3a630765860887',
  },
];

const SAMPLE_UPLOAD = Buffer.from('Haskins Alpha custody upload');

async function seedHaskins(): Promise<FlowResult> {
  const steps: StepResult[] = [];
  try {
    const intake = await post(
      '/intake',
      {
        assetLabel: 'HASKINS-16315',
        docs: HASKINS_DOCS,
      },
      requireToken('intake'),
    );
    steps.push({ name: 'intake', status: 'ok', attestationId: intake.attestationId });

    await wait(150);

    const insurance = await post(
      '/insurance',
      {
        assetLabel: 'HASKINS-16315',
        classCode: 1,
        factorBps: '100000',
        notes: 'Demo coverage 10x real estate multiplier',
      },
      requireToken('insurance'),
    );
    steps.push({ name: 'insurance', status: 'ok', attestationId: insurance.attestationId });

    await wait(150);

    const mint = await post(
      '/mint',
      {
        instrument: 'CSDN',
        assetLabel: 'HASKINS-16315',
        par: '875000',
        notes: 'Intake issuance seed',
      },
      requireToken('mint'),
    );
    const noteId = mint.noteId;
    steps.push({ name: 'mint', status: 'ok', attestationId: mint.attestationId, detail: `note ${noteId}` });

    await wait(150);

    const cycle = await post(
      '/circulate',
      {
        noteId,
        days: 90,
        rateBps: 500,
        notes: 'Demo 90-day liquidity loop',
      },
      requireToken('circulate'),
    );
    steps.push({ name: 'cycle', status: 'ok', attestationId: cycle.attestationId });

    await wait(150);

    const redeem = await post(
      '/redeem',
      {
        noteId,
        amount: '125000',
        notes: 'Demo redemption certificate',
      },
      requireToken('redeem'),
    );
    steps.push({ name: 'redeem', status: 'ok', attestationId: redeem.attestationId });

    if ((process.env.SIGN_ENABLED ?? 'false').toLowerCase() === 'true') {
      try {
        const sign = await post(
          '/sign/envelope',
          {
            assetId: 'HASKINS-16315',
            type: 'STANDARD',
            subject: 'Harvest Estate Fiduciary Signature',
            message: 'DocuSign envelope issued from demo flow.',
            recipients: [{ name: 'Althea Chambers', email: 'law@harvest.estate', role: 'SIGNER' }],
            documents: HASKINS_DOCS.map((doc) => ({ name: doc.type, sha256: doc.hash })),
          },
          requireToken('sign'),
        );
        steps.push({ name: 'sign', status: 'ok', detail: `envelope ${sign.envelopeId}` });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        steps.push({ name: 'sign', status: 'error', detail: message });
      }
    }

    if (UPLOAD_FLAG) {
      try {
        const upload = await post(
          '/vault/upload',
          {
            assetId: 'HASKINS-16315',
            fileName: 'haskins-affidavit.pdf',
            content: SAMPLE_UPLOAD.toString('base64'),
            notify: false,
          },
          requireToken('upload'),
        );
        steps.push({ name: 'vault-upload', status: 'ok', detail: upload.sha256 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        steps.push({ name: 'vault-upload', status: 'error', detail: message });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ADDRESS is required')) {
      steps.push({
        name: 'haskins-seed',
        status: 'skipped',
        detail: 'Contract addresses missing. Populate env vars before running seeding flow.',
      });
    } else {
      steps.push({ name: 'error', status: 'error', detail: message });
    }
  }

  return { asset: 'Haskins Alpha', steps };
}

async function seedCompton(): Promise<FlowResult> {
  const steps: StepResult[] = [
    {
      name: 'intake',
      status: 'skipped',
      detail:
        'Compton #24 custody docs pending (TBD). Update docs/needed-evidence.md once hashes are available.',
    },
  ];
  return { asset: 'Compton Beta', steps };
}

async function main() {
  console.log('Running sovereign demo seeding flow against', BASE_URL);
  const flows = [await seedHaskins(), await seedCompton()];

  for (const flow of flows) {
    console.log(`\n${flow.asset}`);
    for (const step of flow.steps) {
      const detail = step.detail ? ` — ${step.detail}` : '';
      const attestation = step.attestationId ? ` (attestation ${step.attestationId})` : '';
      console.log(`  [${step.status.toUpperCase()}] ${step.name}${attestation}${detail}`);
    }
  }
}

main().catch((error) => {
  console.error('Demo seeding flow failed:', error);
  process.exit(1);
});
