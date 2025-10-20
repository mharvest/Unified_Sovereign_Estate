export interface NavInputs {
  treasuryStableUsd: number;
  insuredReservesUsd: number;
  realizedYieldUsd: number;
  liabilitiesUsd: number;
  supply: number;
  alphaFloor: number;
  spreadBps: number;
}

export interface NavResult {
  navPerToken: number;
  floor: number;
  price: number;
}

const BPS_DIVISOR = 10_000;

export function computeNav(input: NavInputs): NavResult {
  const {
    treasuryStableUsd,
    insuredReservesUsd,
    realizedYieldUsd,
    liabilitiesUsd,
    supply,
    alphaFloor,
    spreadBps,
  } = input;

  const safeSupply = supply > 0 ? supply : 0;
  const netAssets = treasuryStableUsd + insuredReservesUsd + realizedYieldUsd - liabilitiesUsd;
  const navPerToken = safeSupply > 0 ? netAssets / safeSupply : 0;

  const floor = navPerToken * Math.max(0, Math.min(1, alphaFloor));
  const spread = Math.max(0, spreadBps) / BPS_DIVISOR;
  const price = Math.max(0, Math.min(navPerToken, floor) * (1 - spread));

  return {
    navPerToken: round(navPerToken),
    floor: round(floor),
    price: round(price),
  };
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}
