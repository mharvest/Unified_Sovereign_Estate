import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      cycle: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

import { buildApp } from '../src/server.js';
import { createJwt, createStubContracts, MemoryAuditLogger } from './stubs.js';
import { prisma } from '../src/lib/prisma.js';

const requestPayload = {
  noteId: '1',
  tenorDays: 30,
  rateBps: 250,
};

describe('authentication guards', () => {
  const contracts = createStubContracts();

  beforeEach(() => {
    (prisma.cycle.create as unknown as Mock).mockResolvedValue({ id: 'cycle-id' });
    (prisma.auditLog.create as unknown as Mock).mockResolvedValue({ id: 'audit-id' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when token is missing', async () => {
    const app = buildApp({ contracts, audit: new MemoryAuditLogger() });

    const res = await app.inject({
      method: 'POST',
      url: '/cycle/arm',
      payload: requestPayload,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('missing_token');
    expect(prisma.cycle.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 401 when the token signature is invalid', async () => {
    const app = buildApp({ contracts, audit: new MemoryAuditLogger() });

    const res = await app.inject({
      method: 'POST',
      url: '/cycle/arm',
      payload: requestPayload,
      headers: { authorization: 'Bearer not-a-valid-token' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('invalid_token');
    expect(prisma.cycle.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 403 when role is not allowed', async () => {
    const app = buildApp({ contracts, audit: new MemoryAuditLogger() });
    const token = createJwt('LAW');

    const res = await app.inject({
      method: 'POST',
      url: '/cycle/arm',
      payload: requestPayload,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('forbidden');
    expect(prisma.cycle.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('passes through when role is authorized', async () => {
    const app = buildApp({ contracts, audit: new MemoryAuditLogger() });
    const token = createJwt('TREASURY');

    const res = await app.inject({
      method: 'POST',
      url: '/cycle/arm',
      payload: requestPayload,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().ok).toBe(true);
    expect(prisma.cycle.create).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
