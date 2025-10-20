import { describe, expect, it } from 'vitest';
import { buildLedgerCsv } from '../src/routes/ledger.js';

describe('buildLedgerCsv', () => {
  it('creates CSV string with escaping for special characters', () => {
    const csv = buildLedgerCsv([
      {
        id: 1,
        holderId: 'ALPHA-001',
        tokens: '1500.00',
        usdPaid: '1275.00',
        pricePerToken: '0.85',
        createdAt: new Date('2024-07-01T12:00:00.000Z'),
      },
      {
        id: 2,
        holderId: 'BETA,002',
        tokens: '500',
        usdPaid: '410.50',
        pricePerToken: '0.82',
        createdAt: new Date('2024-07-02T12:00:00.000Z'),
      },
    ]);

    const lines = csv.split('\n');
    expect(lines[0]).toBe('ticket_id,holder_id,tokens,usd_paid,price_per_token,created_at');
    expect(lines[1]).toBe('1,ALPHA-001,1500.00,1275.00,0.85,2024-07-01T12:00:00.000Z');
    expect(lines[2]).toBe('2,"BETA,002",500,410.50,0.82,2024-07-02T12:00:00.000Z');
  });
});
