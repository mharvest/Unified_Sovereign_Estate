import { describe, expect, it } from 'vitest';
import { quoteRedemption } from '../src/treasury/redemption.ts';

const nav = {
  navPerToken: 1.05,
  floor: 0.95,
  price: 0.9,
};

describe('quoteRedemption', () => {
  it('quotes a redemption when guard conditions pass', () => {
    const quote = quoteRedemption({
      holderId: 'ALPHA-001',
      tokensRequested: 500,
      availableSupply: 10_000,
      stableUsd: 100_000,
      nav,
    });

    expect(quote.usdOwed).toBeCloseTo(450);
    expect(quote.pricePerToken).toBe(nav.price);
  });

  it('blocks requests that exceed supply', () => {
    expect(() =>
      quoteRedemption({
        holderId: 'ALPHA-001',
        tokensRequested: 12_000,
        availableSupply: 10_000,
        stableUsd: 100_000,
        nav,
      }),
    ).toThrowError('insufficient_supply');
  });

  it('respects policy caps', () => {
    expect(() =>
      quoteRedemption({
        holderId: 'ALPHA-001',
        tokensRequested: 2_000,
        availableSupply: 10_000,
        stableUsd: 100_000,
        nav,
        policy: { maxPercentPerTxn: 10 },
      }),
    ).toThrowError('exceeds_policy_percent_cap');
  });
});
