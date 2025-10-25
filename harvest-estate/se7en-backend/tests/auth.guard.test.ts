import { describe, expect, it } from 'vitest';
import type { FiduciaryRole } from '@prisma/client';
import { buildApp } from '../src/server.js';
import { createJwt, createStubContracts, MemoryAuditLogger } from './stubs.js';

const payload = {
  instrument: 'CSDN',
  assetLabel: 'HASKINS-16315',
  par: '1000',
};

describe('authentication guards', () => {
  it('returns 401 when token is missing', async () => {
    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger() });

    const res = await app.inject({
      method: 'POST',
      url: '/mint',
      payload,
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('missing_token');
    await app.close();
  });

  it('returns 403 when role is not allowed', async () => {
    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger() });
    const token = createJwt('LAW' as FiduciaryRole);

    const res = await app.inject({
      method: 'POST',
      url: '/mint',
      payload,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe('forbidden');
    await app.close();
  });
});
