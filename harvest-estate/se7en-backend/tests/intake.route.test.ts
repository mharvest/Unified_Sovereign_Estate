import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../src/chain/safevault.js', () => ({
  computeAssetId: vi.fn(() => '0xmock-asset-id'),
  registerCustody: vi.fn(),
}));

import { buildApp } from '../src/server.js';
import { createJwt, createStubContracts } from './stubs.js';
import { prisma } from '../src/lib/prisma.js';
import { registerCustody } from '../src/chain/safevault.js';

describe('POST /intake', () => {
  const token = createJwt('LAW');
  const contracts = createStubContracts();
  const registerCustodyFn = registerCustody as unknown as Mock;
  const auditCreateMock = prisma.auditLog.create as unknown as Mock;

  beforeEach(() => {
    auditCreateMock.mockReset();
    registerCustodyFn.mockReset();
  });

  it('registers custody evidence and returns a signature', async () => {
    registerCustodyFn.mockResolvedValue({ signature: '0xcustody', skipped: false });
    auditCreateMock.mockResolvedValue({ id: 'audit-1' });

    const app = buildApp({ contracts });
    const response = await app.inject({
      method: 'POST',
      url: '/intake',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        assetLabel: 'HASKINS-16315',
        docs: [
          {
            type: 'APPRAISAL',
            hash: '0x' + 'a'.repeat(64),
          },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(body.assetId).toBe('0xmock-asset-id');
    expect(body.signature).toBe('0xcustody');
    expect(body.custodyStatus).toBe('registered');
    expect(body.todo).toBeNull();

    expect(registerCustodyFn).toHaveBeenCalledTimes(1);
    expect(registerCustodyFn.mock.calls[0][0]?.assetIdHex).toBe('0xmock-asset-id');
    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    const auditPayload = auditCreateMock.mock.calls[0][0];
    expect(auditPayload.data.action).toBe('INTAKE_SUBMITTED');
    expect(auditPayload.data.payload.result).toBe('ok');

    await app.close();
  });

  it('returns a warning when custody registration is skipped', async () => {
    registerCustodyFn.mockResolvedValue({
      signature: null,
      skipped: true,
      reason: 'provider_error',
    });
    auditCreateMock.mockResolvedValue({ id: 'audit-2' });

    const app = buildApp({ contracts });
    const response = await app.inject({
      method: 'POST',
      url: '/intake',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        assetLabel: 'HASKINS-16315',
        docs: [
          {
            type: 'APPRAISAL',
            hash: '0x' + 'b'.repeat(64),
          },
        ],
        notes: 'Missing doc stored on Solana',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.custodyStatus).toBe('submitted_with_warning');
    expect(body.signature).toBeNull();
    expect(body.todo).toBe('provider_error');

    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    const auditPayload = auditCreateMock.mock.calls[0][0];
    expect(auditPayload.data.action).toBe('INTAKE_SUBMITTED_WITH_WARNING');
    expect(auditPayload.data.payload.result).toBe('warn');

    await app.close();
  });
});
