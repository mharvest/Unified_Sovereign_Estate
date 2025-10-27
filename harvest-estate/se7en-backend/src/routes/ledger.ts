import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { buildLedgerCsv, toLedgerRecord } from '../lib/ledger.js';
import type { FiduciaryRole } from '../plugins/auth.js';

export default async function ledgerRoutes(app: FastifyInstance) {
  app.get(
    '/ledger/export',
    { preHandler: app.authorize(['AUDITOR', 'GOVERNANCE', 'LAW'] as FiduciaryRole[]) },
    async (request, reply) => {
      const entries = await prisma.auditLog.findMany({
        where: {
          action: {
            in: ['REDEMPTION', 'REDEMPTION_TICKET', 'REDEMPTION_SETTLED'],
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const rows = entries.map((entry) => {
        const payload = (entry.payload ?? {}) as Record<string, unknown>;
        return toLedgerRecord({
          id: entry.id,
          holderId: (payload.holderId as string | undefined) ?? (payload.actor as string | undefined) ?? entry.assetId,
          tokens: payload.tokens ?? payload.amount ?? '',
          usdPaid: payload.usdPaid ?? payload.usdOwed ?? '',
          pricePerToken: payload.pricePerToken ?? payload.navPerToken ?? '',
          createdAt: entry.createdAt,
        });
      });

      const csv = buildLedgerCsv(rows);
      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename=\"ledger.csv\"')
        .send(csv);
    },
  );
}
