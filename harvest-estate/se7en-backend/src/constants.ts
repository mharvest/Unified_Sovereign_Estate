export const SERVICE_NAME = 'se7en-orchestrator';

export const JURISDICTION_TAG = 'UHMI 508(c)(1)(a); Cheroenhaka (Nottoway) Treaty 1713';

export const CLAUSES = {
  INTAKE: 'INTAKE',
  ISSUANCE: 'ISSUANCE',
  INSURANCE: 'INSURANCE',
  CYCLE: 'CYCLE',
  REDEMPTION: 'REDEMPTION',
} as const;

export const ACTION_NAMES = {
  ISSUANCE: 'ISSUANCE',
  NAV_UPDATE: 'NAV_UPDATE',
  REDEMPTION: 'REDEMPTION',
} as const;

export type Clause = typeof CLAUSES[keyof typeof CLAUSES];
export type ActionName = typeof ACTION_NAMES[keyof typeof ACTION_NAMES];
