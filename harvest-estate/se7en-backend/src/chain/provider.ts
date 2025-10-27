import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AnchorProvider, setProvider, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

const DEFAULT_PROGRAM_ID = '6hhNH6ez64m6staC2fqXW2oxEnXwpGyXXSnBNt5Gr41V';

export function getClusterUrl(): string {
  return process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
}

export function getProgramId(): PublicKey {
  const raw = process.env.SAFEVAULT_PROGRAM_ID || DEFAULT_PROGRAM_ID;
  return new PublicKey(raw);
}

export function loadKeypair(): Keypair {
  const keyPath =
    process.env.SAFEVAULT_KEYPAIR_PATH || path.join(os.homedir(), '.config', 'solana', 'id.json');
  const secret = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

export function getAnchorProvider(): AnchorProvider {
  const connection = new Connection(getClusterUrl(), 'confirmed');
  const wallet = new Wallet(loadKeypair());
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  setProvider(provider);
  return provider;
}
