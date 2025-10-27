import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    audit: AuditLogger;
  }
}

export interface AuditEntry {
  action: string;
  assetId?: string;
  attestationId?: string | null;
  txHash?: string | null;
  payload?: unknown;
}

export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
  history(limit?: number): Promise<AuditLogRecord[]>;
}

export interface AuditLogRecord {
  id: number;
  action: string;
  assetId: string;
  attestationId: string | null;
  txHash: string | null;
  payload: unknown;
  createdAt: Date;
}

const prisma = new PrismaClient();

export default fp(async (app: FastifyInstance) => {
  if (!app.hasDecorator('audit')) {
    const logger: AuditLogger = {
      async log(entry) {
        await prisma.auditLog.create({
          data: {
            action: entry.action,
            assetId: entry.assetId ?? 'system',
            attestationId: entry.attestationId ?? null,
            txHash: entry.txHash ?? null,
            payload: entry.payload ?? {},
          },
        });
      },
      async history(limit = 50) {
        const records = await prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        return records.map((record) => ({
          id: record.id,
          action: record.action,
          assetId: record.assetId,
          attestationId: record.attestationId,
          txHash: record.txHash,
          payload: record.payload,
          createdAt: record.createdAt,
        }));
      },
    };

    app.decorate('audit', logger);
  }

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
