import type { FastifyInstance, FastifyReply } from 'fastify';
import { clients } from './contracts.js';

const ZERO_ADDRESS_PATTERN = /^0x0{40}$/i;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

function isMissing(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  if (!value.startsWith('0x') || value.length !== 42) return true;
  return ZERO_ADDRESS_PATTERN.test(value);
}

export function missingAddresses(): string[] {
  return Object.entries(clients)
    .filter(([, value]) => value === 'missing' || isMissing(value))
    .map(([key]) => key);
}

export async function ensureContractsConfigured(
  app: FastifyInstance,
  reply: FastifyReply,
  action: string,
  metadata?: unknown,
): Promise<boolean> {
  const missing = missingAddresses();
  if (missing.length === 0) {
    return true;
  }

  if (app.audit) {
    await app.audit.log({
      action,
      assetId: 'system',
      payload: {
        result: 'error',
        reason: 'ADDR_MISSING',
        missing,
        metadata,
      },
    });
  }

  await reply.status(501).send({ ok: false, error: 'address_missing', missing });
  return false;
}

export function markClientsConfiguredForTests() {
  Object.keys(clients).forEach((key) => {
    clients[key as keyof typeof clients] = '0x0000000000000000000000000000000000000001';
  });
}
