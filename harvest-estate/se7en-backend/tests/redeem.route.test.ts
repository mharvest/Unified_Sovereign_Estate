import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/server.js';
import { createJwt, createStubContracts, MemoryAuditLogger } from './stubs.js';
import * as requiredInputs from '../src/lib/requiredInputs.ts';

const NOTE_ASSET = ('0x' + 'c'.repeat(64)) as `0x${string}`;

describe('POST /redeem', () => {
  beforeEach(() => {
    vi.spyOn(requiredInputs, 'updateEvidenceDoc').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns precondition todos when live readiness inputs are missing', async () => {
    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger() });
    const token = createJwt('TREASURY');

    const res = await app.inject({
      method: 'POST',
      url: '/redeem',
      payload: {
        noteId: '1',
        amount: '100',
      },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(428);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('preconditions_not_met');
    expect(Array.isArray(body.todos)).toBe(true);
    expect(body.detail).toContain('redemption');

    await app.close();
  });

  it('surfaces the placeholder response when preconditions pass', async () => {
    const requiredKeys = [
      'SOLANA_RPC_URL',
      'SOLANA_EXPLORER_BASE',
      'EKLESIA_ADDRESS',
      'SAFEVAULT_ADDRESS',
      'EYEION_ADDRESS',
      'VAULTQUANT_ADDRESS',
      'MATRIARCH_ADDRESS',
      'HRVST_ADDRESS',
      'KIIANTU_ADDRESS',
      'ANIMA_ADDRESS',
      'JWT_PUBLIC_KEY_BASE64',
      'INTERNAL_MTLS_CA_BASE64',
      'INTERNAL_MTLS_CERT_BASE64',
      'INTERNAL_MTLS_KEY_BASE64',
      'AES_KEYRING_BASE64',
      'CUSTODY_ALPHA_HASKINS_SHA256',
      'CUSTODY_BETA_COMPTON_SHA256',
      'ACTUARIAL_TABLES_JSON_SHA256',
      'NAV_FEED_ENDPOINT',
      'NAV_FEED_SIGNING_PUBKEY',
      'SMTP_URL',
      'SAFEVAULT_IPFS_API',
      'SAFEVAULT_IPFS_TOKEN',
    ] as const;

    const envBackup: Record<string, string | undefined> = {};
    for (const key of requiredKeys) {
      envBackup[key] = process.env[key];
      process.env[key] = key.includes('BASE64') ? Buffer.from('test').toString('base64') : 'test-value';
    }
    process.env.LIVE_MODE = 'true';

    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger() });
    const token = createJwt('TREASURY');

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/redeem',
        payload: {
          noteId: '1',
          amount: '250',
        },
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(428);
      const body = res.json();
      expect(body.ok).toBe(false);
      expect(body.detail).toContain('VaultQuant redemption path pending');
      expect(body.todos).toBeInstanceOf(Array);
    } finally {
      await app.close();
      for (const key of requiredKeys) {
        process.env[key] = envBackup[key];
      }
      delete process.env.LIVE_MODE;
    }
  });
});
