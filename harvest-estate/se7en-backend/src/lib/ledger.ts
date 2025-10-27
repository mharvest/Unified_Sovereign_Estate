export interface LedgerRecord {
  ticketId: string;
  holderId: string;
  tokens: string;
  usdPaid: string;
  pricePerToken: string;
  createdAt: Date;
}

const HEADERS = ['ticket_id', 'holder_id', 'tokens', 'usd_paid', 'price_per_token', 'created_at'] as const;

export function buildLedgerCsv(rows: LedgerRecord[]): string {
  const headerLine = HEADERS.join(',');
  const lines = rows.map((row) => {
    const values = [
      row.ticketId,
      row.holderId,
      row.tokens,
      row.usdPaid,
      row.pricePerToken,
      row.createdAt.toISOString(),
    ];
    return values.map(escapeCsv).join(',');
  });

  return [headerLine, ...lines].join('\n');
}

export function toLedgerRecord(input: {
  id: number | string;
  holderId?: string | null;
  tokens?: string | number | null;
  usdPaid?: string | number | null;
  pricePerToken?: string | number | null;
  createdAt: Date;
}): LedgerRecord {
  const toString = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return value.toISOString();
    return String(value);
  };

  return {
    ticketId: toString(input.id),
    holderId: toString(input.holderId ?? ''),
    tokens: toString(input.tokens ?? ''),
    usdPaid: toString(input.usdPaid ?? ''),
    pricePerToken: toString(input.pricePerToken ?? ''),
    createdAt: input.createdAt,
  };
}

function escapeCsv(value: string): string {
  if (value === '') return '';
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
