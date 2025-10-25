export interface NavPools {
  stable: number;
  insured: number;
  yield: number;
  liab: number;
  supply: number;
}

export interface NavSnapshot {
  ts: number;
  ok: boolean;
  navPerToken: number;
  floor: number;
  price: number;
  pools?: NavPools;
}

interface TweenOptions {
  navAmplitude?: number;
  floorAmplitude?: number;
  priceAmplitude?: number;
  poolAmplitude?: number;
  baseFrequencyMs?: number;
}

const DEFAULT_OPTIONS: Required<TweenOptions> = {
  navAmplitude: 0.08,
  floorAmplitude: 0.06,
  priceAmplitude: 0.1,
  poolAmplitude: 0.05,
  baseFrequencyMs: 8_000,
};

const ensureAmplitude = (base: number, ratio: number, minimum: number) =>
  Math.max(Math.abs(base) * ratio, minimum);

export function createNavTweener(base: NavSnapshot, options: TweenOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const baseCopy: NavSnapshot = {
    ...base,
    pools: base.pools ? { ...base.pools } : undefined,
  };

  return (timeMs: number): NavSnapshot => {
    const phase = ((timeMs % opts.baseFrequencyMs) / opts.baseFrequencyMs) * Math.PI * 2;

    const wobble = (value: number, ratio: number, minimum: number, offset: number) =>
      Math.max(value + ensureAmplitude(value, ratio, minimum) * Math.sin(phase + offset), 0);

    const next: NavSnapshot = {
      ...baseCopy,
      navPerToken: wobble(baseCopy.navPerToken, opts.navAmplitude, 0.01, 0),
      floor: wobble(baseCopy.floor, opts.floorAmplitude, 0.01, Math.PI / 2),
      price: wobble(baseCopy.price, opts.priceAmplitude, 0.01, Math.PI),
    };

    if (baseCopy.pools) {
      next.pools = {
        stable: wobble(baseCopy.pools.stable, opts.poolAmplitude, 50_000, 0.3),
        insured: wobble(baseCopy.pools.insured, opts.poolAmplitude, 50_000, 1.2),
        yield: wobble(baseCopy.pools.yield, opts.poolAmplitude * 1.6, 15_000, 2.4),
        liab: wobble(baseCopy.pools.liab, opts.poolAmplitude * 0.8, 20_000, 3.6),
        supply: wobble(baseCopy.pools.supply, opts.poolAmplitude * 0.6, 75_000, 4.5),
      };
    }

    return next;
  };
}
