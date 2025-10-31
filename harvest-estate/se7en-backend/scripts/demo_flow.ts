#!/usr/bin/env tsx
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { assertDemoReady } from './scriptUtils.js';
import { signJwt, verifyJwt } from '../src/lib/jwt.js';

type FetchOptions = {
  token?: string;
  method?: string;
  headers?: Record<string, string>;
};

type StepRecord = {
  name: string;
  detail: Record<string, unknown>;
};

const DEFAULT_DOCS = [
  { type: 'APPRAISAL', hash: '0x721a90229d9d7d1899a75be9cfe6ea5e12a57cc1df4c92b6cf7ad79f0e1f58c7' },
  { type: 'TITLE/DEED', hash: '0x95817b41c98d36d864dbd31a73dec110f9701ce602757754f2300bc64a90f1c6' },
  { type: 'PAYOFF', hash: '0x3f731c6dca8535f6fcc61ab58f1395cce6aae1ec5d0d26e4eb3a630765860887' },
];

const ROLE_BY_KEY = {
  law: 'LAW',
  ops: 'OPS',
  treasury: 'TREASURY',
  insurance: 'INSURANCE',
} as const;

type RoleKey = keyof typeof ROLE_BY_KEY;
type RoleName = (typeof ROLE_BY_KEY)[RoleKey];

const REQUIRED_TOKENS: Record<RoleKey, string[]> = {
  law: ['SE7EN_DEMO_JWT_LAW', 'SE7EN_DEMO_JWT'],
  ops: ['SE7EN_DEMO_JWT_OPS', 'SE7EN_DEMO_JWT'],
  treasury: ['SE7EN_DEMO_JWT_TREASURY', 'SE7EN_DEMO_JWT'],
  insurance: ['SE7EN_DEMO_JWT_INSURANCE', 'SE7EN_DEMO_JWT'],
};

function parseAudience(): string | string[] | undefined {
  const raw = process.env.JWT_AUDIENCE;
  if (!raw) return undefined;
  const values = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function resolveTokenFactory(secret: string) {
  const issuer = process.env.JWT_ISSUER?.trim() || undefined;
  const audience = parseAudience();
  const ttlSeconds = Number(process.env.DEMO_JWT_TTL_SECONDS ?? '7200');
  const cache: Partial<Record<RoleKey, string>> = {};
  const verifyOptions = { issuer, audience };

  const isTokenUsable = (token: string, role: RoleName): boolean => {
    try {
      const claims = verifyJwt(token, secret, verifyOptions);
      if (claims.role && claims.role !== role) {
        return false;
      }
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp != null && claims.exp - now < 60) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const mintToken = (role: RoleName): string => {
    const subject = `demo-${role.toLowerCase()}`;
    const payload = {
      sub: subject,
      email: `${subject}@harvest.estate`,
      role,
    };
    return signJwt(payload, secret, {
      expiresInSeconds: ttlSeconds,
      issuer,
      audience,
    });
  };

  return (key: RoleKey): string => {
    if (cache[key]) {
      return cache[key]!;
    }

    for (const envVar of REQUIRED_TOKENS[key]) {
      const value = process.env[envVar];
      if (value && value.trim().length > 0 && isTokenUsable(value.trim(), ROLE_BY_KEY[key])) {
        cache[key] = value.trim();
        return cache[key]!;
      }
    }

    const minted = mintToken(ROLE_BY_KEY[key]);
    cache[key] = minted;
    console.log(`[demo:alpha] minted JWT for ${ROLE_BY_KEY[key]}`);
    return minted;
  };
}

function ensureEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

async function apiRequest<T>(
  path: string,
  body: Record<string, unknown>,
  { token, method = 'POST', headers: extraHeaders }: FetchOptions = {},
): Promise<T> {
  const baseUrl = process.env.SE7EN_BASE_URL?.trim() || 'http://localhost:4000';
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers[key] = value;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>).detail ??
          (payload as Record<string, unknown>).error ??
          JSON.stringify(payload)
        : text || response.statusText;
    throw new Error(`${method} ${path} failed (${response.status}): ${message}`);
  }

  return payload as T;
}

async function runStep<T>(
  timeline: StepRecord[],
  name: string,
  fn: () => Promise<T>,
  projector?: (result: T) => Record<string, unknown>,
): Promise<T> {
  console.log(`[demo:alpha] ${name}…`);
  const result = await fn();
  const detail = projector ? projector(result) : (result as unknown as Record<string, unknown>);
  timeline.push({ name, detail });
  console.log(`[demo:alpha] ${name} completed.`);
  return result;
}

async function main() {
  const { todos } = assertDemoReady('demo:alpha');
  if (todos.length > 0) {
    process.exit(1);
  }

  const assetLabel = ensureEnv('DEMO_ASSET_LABEL', 'HASKINS-16315');
  const instrument = ensureEnv('DEMO_INSTRUMENT', 'CSDN');
  const notionalUsd = ensureEnv('DEMO_NOTIONAL_USD', '875000');
  const classCode = Number(process.env.DEMO_CLASS_CODE ?? '1');
  const tenorDays = Number(process.env.DEMO_CYCLE_TENOR_DAYS ?? '90');
  const rateBps = Number(process.env.DEMO_CYCLE_RATE_BPS ?? '475');

  const jwtSecret = ensureEnv('JWT_SECRET');
  const resolveToken = resolveTokenFactory(jwtSecret);
  const tokens: Record<RoleKey, string> = {
    law: resolveToken('law'),
    ops: resolveToken('ops'),
    treasury: resolveToken('treasury'),
    insurance: resolveToken('insurance'),
  };
  const vaultNotifyEnabled = (process.env.DEMO_VAULT_NOTIFY ?? 'false').toLowerCase() === 'true';
  const vaultRecipientCandidates =
    process.env.DEMO_VAULT_NOTIFY_TO ??
    process.env.SAFEVAULT_NOTIFICATION_TO ??
    'ops@harvest.estate';
  const vaultRecipients = vaultRecipientCandidates
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const timeline: StepRecord[] = [];

  const intake = await runStep(
    timeline,
    'Custody intake',
    async () =>
      apiRequest<{ assetId: string; custodyStatus: string; signature: string | null }>(
        '/intake',
        {
          assetLabel,
          docs: DEFAULT_DOCS,
          notes: 'Demo intake initiated via automation script.',
        },
        { token: tokens.ops },
      ),
    (result) => ({
      assetId: result.assetId,
      custodyStatus: result.custodyStatus,
    }),
  );

  const assetIdHex = intake.assetId;
  const safeVaultAssetRef = process.env.DEMO_SAFEVAULT_ASSET ?? assetLabel;

  const upload = await runStep(
    timeline,
    'SafeVault upload',
    async () =>
      apiRequest<{ assetId: string; sha256: string }>(
        '/vault/upload',
        {
          assetId: safeVaultAssetRef,
          fileName: `demo-affidavit-${randomUUID()}.txt`,
          content: Buffer.from(
            `Demo SafeVault evidence for ${assetLabel} at ${new Date().toISOString()}`,
            'utf8',
          ).toString('base64'),
          mimeType: 'text/plain',
          notify: vaultNotifyEnabled,
          recipients: vaultNotifyEnabled ? vaultRecipients : undefined,
        },
        { token: tokens.ops },
      ),
    (result) => ({
      assetId: result.assetId,
      sha256: result.sha256,
    }),
  );

  const issuance = await runStep(
    timeline,
    'Treasury issuance',
    async () =>
      apiRequest<{ ok: boolean; issuanceId: string; noteId: string | null }>(
        '/issuance',
        {
          assetLabel,
          instrument,
          notionalUsd,
          notes: 'Demo issuance created via automation script.',
        },
        { token: tokens.treasury },
      ),
    (result) => ({
      issuanceId: result.issuanceId,
      noteId: result.noteId,
    }),
  );

  if (!issuance.noteId) {
    throw new Error('Issuance did not return a noteId; cannot continue demo flow.');
  }

  const insurance = await runStep(
    timeline,
    'Matriarch insurance binding',
    async () =>
      apiRequest<{
        ok: boolean;
        binderId: string | null;
        coverageClass: string;
        multiplier: number;
      }>(
        '/insurance',
        {
          assetLabel,
          classCode,
          notes: 'Demo insurance binder via automation script.',
        },
        { token: tokens.insurance },
      ),
    (result) => ({
      binderId: result.binderId,
      coverageClass: result.coverageClass,
      multiplier: result.multiplier,
    }),
  );

  const pegMint = await runStep(
    timeline,
    'NAV peg mint',
    async () =>
      apiRequest<{
        ok: boolean;
        amount: string | null;
        txHash: string | null;
        navSource: string | null;
      }>(
        '/peg/mint',
        {
          issuanceId: issuance.issuanceId,
          noteId: issuance.noteId,
          recipient: process.env.DEMO_MINT_RECIPIENT ?? undefined,
        },
        { token: tokens.treasury },
      ),
    (result) => ({
      amount: result.amount,
      txHash: result.txHash,
      navSource: result.navSource,
    }),
  );

  const cycle = await runStep(
    timeline,
    'Cycle arm',
    async () =>
      apiRequest<{
        ok: boolean;
        cycleId: string | null;
        cycleRecordId: string | null;
      }>(
        '/cycle/arm',
        {
          noteId: issuance.noteId,
          tenorDays,
          rateBps,
          notes: 'Demo cycle armed via automation script.',
        },
        { token: tokens.treasury },
      ),
    (result) => ({
      cycleId: result.cycleId,
      cycleRecordId: result.cycleRecordId,
    }),
  );

  const envelope = await runStep(
    timeline,
    'DocuSign envelope',
    async () =>
      apiRequest<{ ok: boolean; envelopeId: string; status: string }>(
        '/sign/envelope',
        {
          assetId: assetIdHex,
          subject: `Demo Envelope for ${assetLabel}`,
          message: 'DocuSign stub envelope generated by automation script.',
          recipients: [
            { name: 'Althea Chambers', email: 'law@harvest.estate', role: 'SIGNER' },
            { name: 'Vera Holt', email: 'treasury@harvest.estate', role: 'CC' },
          ],
          documents: [
            {
              name: upload.sha256,
              sha256:
                typeof upload.sha256 === 'string' && upload.sha256.startsWith('0x')
                  ? upload.sha256
                  : `0x${upload.sha256 ?? ''}`,
            },
          ],
        },
        { token: tokens.law },
      ),
    (result) => ({
      envelopeId: result.envelopeId,
      status: result.status,
    }),
  );

  await runStep(
    timeline,
    'DocuSign webhook acknowledgement',
    async () =>
      apiRequest<unknown>(
        '/sign/webhook',
        {
          envelopeId: envelope.envelopeId,
          status: 'COMPLETED',
          signerEmail: 'law@harvest.estate',
          signedAt: new Date().toISOString(),
          event: {
            eventId: `evt_${randomUUID()}`,
            type: 'completed',
            occurredAt: new Date().toISOString(),
          },
        },
        {
          method: 'POST',
          headers: {
            'x-docusign-signature-1': 'demo-signature',
          },
        },
      ),
    () => ({ envelopeId: envelope.envelopeId, status: 'COMPLETED' }),
  );

  // Give asynchronous audit/subscriber hooks a moment to settle.
  await delay(250);

  console.log('\n[demo:alpha] flow summary');
  for (const step of timeline) {
    console.log(` • ${step.name}`);
    for (const [key, value] of Object.entries(step.detail)) {
      if (value === undefined || value === null) continue;
      console.log(`   - ${key}: ${value}`);
    }
  }
  console.log('\n[demo:alpha] orchestration completed successfully.');
  process.exit(0);
}

main().catch((error) => {
  console.error('[demo:alpha] flow failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
