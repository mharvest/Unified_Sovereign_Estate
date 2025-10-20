import { describe, expect, it } from 'vitest';
import { buildLedgerCsv } from '../src/routes/ledger.js';

describe('buildLedgerCsv', () => {
  it('formats rows into CSV with escaping', () => {
    const csv = buildLedgerCsv([
      {
        id: 1,
        holderId: 'H-001',
        tokens: '1500.00',
        usdPaid: '1200.50',
        pricePerToken: '0.80',
        createdAt: new Date('2024-01-02T03:04:05.000Z'),
      },
      {
        id: 2,
        holderId: 'H-002',
        tokens: '500',
        usdPaid: '403.75',
        pricePerToken: '0.81',
        createdAt: new Date('2024-01-03T03:04:05.000Z'),
      },
      {
        id: 3,
        holderId: 'H,003',
        tokens: '100',
        usdPaid: '80',
        pricePerToken: '0.80',
        createdAt: new Date('2024-01-04T03:04:05.000Z'),
      },
    ]);

    const lines = csv.split('\n');
    expect(lines[0]).toEqual('ticket_id,holder_id,tokens,usd_paid,price_per_token,created_at');
    expect(lines[1]).toContain('1,H-001,1500.00,1200.50,0.80,2024-01-02T03:04:05.000Z');
    expect(lines[2]).toContain('2,H-002,500,403.75,0.81,2024-01-03T03:04:05.000Z');
    expect(lines[3]).toContain('3,"H,003",100,80,0.80,2024-01-04T03:04:05.000Z');
  });
});
