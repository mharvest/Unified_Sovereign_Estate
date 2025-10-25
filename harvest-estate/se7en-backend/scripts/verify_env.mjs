#!/usr/bin/env node
import { config } from 'dotenv';
import path from 'node:path';

const envFile = process.env.ENV_FILE;
if (envFile) {
  const resolved = path.isAbsolute(envFile) ? envFile : path.resolve(process.cwd(), envFile);
  config({ path: resolved, override: true });
} else {
  config();
}

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required but missing');
  process.exit(1);
}

const CONTRACT_VARS = [
  ['EKLESIA_ADDRESS', 'eklesia'],
  ['SAFEVAULT_ADDRESS', 'safevault'],
  ['EYEION_ADDRESS', 'eyeion'],
  ['VAULTQUANT_ADDRESS', 'vaultquant'],
  ['MATRIARCH_ADDRESS', 'matriarch'],
  ['HRVST_ADDRESS', 'hrvst'],
  ['KIANITU_ADDRESS', 'kiiantu'],
  ['ANIMA_ADDRESS', 'anima'],
];

const zeroPattern = /^0x0{40}$/i;

const missing = CONTRACT_VARS.filter(([envName]) => {
  const value = (process.env[envName] ?? '').trim();
  return value.length !== 42 || !value.startsWith('0x') || zeroPattern.test(value);
});

if (missing.length > 0) {
  console.error('Missing contract addresses:', missing.map(([env]) => env).join(', '));
  process.exit(1);
}

console.log('All contract addresses detected.');
