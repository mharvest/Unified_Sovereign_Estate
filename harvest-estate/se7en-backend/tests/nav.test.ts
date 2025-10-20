import { describe, expect, it } from 'vitest';
import { computeNav } from '../src/treasury/nav.js';

describe('computeNav', () => {
  it('calculates nav, floor, and price with spread', () => {
    const result = computeNav({
      treasuryStableUsd: 1_000_000,
      insuredReservesUsd: 500_000,
      realizedYieldUsd: 120_000,
      liabilitiesUsd: 80_000,
      supply: 2_000_000,
      alphaFloor: 0.8,
      spreadBps: 50,
    });

    expect(result.navPerToken).toBeCloseTo(0.77, 2);
    expect(result.floor).toBeCloseTo(0.62, 2);
    expect(result.price).toBeLessThanOrEqual(result.floor);
  });

  it('handles zero supply gracefully', () => {
    const result = computeNav({
      treasuryStableUsd: 100,
      insuredReservesUsd: 50,
      realizedYieldUsd: 0,
      liabilitiesUsd: 0,
      supply: 0,
      alphaFloor: 0.75,
      spreadBps: 25,
    });

    expect(result.navPerToken).toBe(0);
    expect(result.price).toBe(0);
  });
});
