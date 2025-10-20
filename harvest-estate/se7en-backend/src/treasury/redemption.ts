import { NavResult } from './nav';

export interface RedemptionPolicy {
  maxPercentPerTxn?: number; // expressed as percentage of circulating supply
  maxUsdPerTxn?: number;
}

export interface RedemptionContext {
  holderId: string;
  tokensRequested: number;
  availableSupply: number;
  stableUsd: number;
  nav: NavResult;
  policy?: RedemptionPolicy;
}

export interface RedemptionQuote {
  holderId: string;
  tokens: number;
  usdOwed: number;
  pricePerToken: number;
  navPerToken: number;
}

export function quoteRedemption(ctx: RedemptionContext): RedemptionQuote {
  const { holderId, tokensRequested, availableSupply, stableUsd, nav, policy } = ctx;

  if (!holderId.trim()) {
    throw new Error('holder_id_required');
  }
  if (!Number.isFinite(tokensRequested) || tokensRequested <= 0) {
    throw new Error('tokens_must_be_positive');
  }
  if (!Number.isFinite(availableSupply) || availableSupply <= 0) {
    throw new Error('token_supply_uninitialized');
  }
  if (tokensRequested > availableSupply) {
    throw new Error('insufficient_supply');
  }
  if (nav.price <= 0) {
    throw new Error('price_unavailable');
  }

  const usdOwed = tokensRequested * nav.price;
  if (usdOwed > stableUsd + 1e-6) {
    throw new Error('insufficient_stable_reserves');
  }

  if (policy?.maxPercentPerTxn) {
    const percent = (tokensRequested / availableSupply) * 100;
    if (percent > policy.maxPercentPerTxn) {
      throw new Error('exceeds_policy_percent_cap');
    }
  }

  if (policy?.maxUsdPerTxn && usdOwed > policy.maxUsdPerTxn) {
    throw new Error('exceeds_policy_usd_cap');
  }

  return {
    holderId,
    tokens: round(tokensRequested),
    usdOwed: round(usdOwed),
    pricePerToken: round(nav.price),
    navPerToken: round(nav.navPerToken),
  };
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
