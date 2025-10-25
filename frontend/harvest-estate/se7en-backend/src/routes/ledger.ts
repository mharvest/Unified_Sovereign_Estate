import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HEADERS = [
  'ticket_id',
  'holder_id',
  'tokens',
  'usd_paid',
  'price_per_token',
  'created_at',
];

interface LedgerRow {
  id: number;
  holderId: string;
  tokens: unknown;
  usdPaid: unknown;
  pricePerToken: unknown;
  createdAt: Date;
}

export function buildLedgerCsv(rows: LedgerRow[]): string {
  const header = HEADERS.join(',');
  const lines = rows.map((row) => {
    const values = [
      row.id.toString(),
      row.holderId,
      toString(row.tokens),
      toString(row.usdPaid),
      toString(row.pricePerToken),
      row.createdAt.toISOString(),
    ];
    return values.map(escapeCsv).join(',');
  });

  return [header, ...lines].join('\n');
}

function toString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && 'toString' in value) {
    return (value as { toString: () => string }).toString();
  }
  return String(value);
}

function escapeCsv(value: string): string {
  if (value === '') return '';
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default async function ledgerRoutes(app: FastifyInstance) {
  app.get('/api/ledger/export', async (_req, reply) => {
    const tickets = await prisma.redemptionTicket.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const csv = buildLedgerCsv(
      tickets.map((ticket) => ({
        ...ticket,
      })),
    );

    reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename=\"ledger.csv\"')
      .send(csv);
  });
}
