import { Hex, keccak256, parseUnits, stringToHex } from 'viem';
import { ACTION_NAMES, type ActionName } from '../constants.js';

export function labelToAssetId(label: string): Hex {
  if (!label) {
    throw new Error('assetLabel is required');
  }
  return keccak256(stringToHex(label));
}

export function normalizeBytes32(value: string, field: string): Hex {
  if (!value.startsWith('0x')) {
    throw new Error(`${field} must be 0x-prefixed`);
  }
  if (value.length !== 66) {
    throw new Error(`${field} must be 32 bytes`);
  }
  return value as Hex;
}

export function encodeJson(data: unknown): Hex {
  return stringToHex(JSON.stringify(data));
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function payloadHash(data: unknown): Hex {
  return keccak256(encodeJson(data));
}

export function parseAmountWei(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    return parseUnits(value.toString(), 18);
  }
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return BigInt(value);
    }
    return parseUnits(value, 18);
  }
  throw new Error('Unsupported amount value');
}

const actionHashCache = new Map<ActionName, Hex>();

export function actionHash(name: ActionName): Hex {
  if (actionHashCache.has(name)) {
    return actionHashCache.get(name)!;
  }
  const hash = keccak256(stringToHex(ACTION_NAMES[name]));
  actionHashCache.set(name, hash);
  return hash;
}
