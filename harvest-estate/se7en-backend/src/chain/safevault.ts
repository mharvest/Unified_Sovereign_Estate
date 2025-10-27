import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { BorshCoder, Program } from '@coral-xyz/anchor';
import { convertIdlToCamelCase } from '@coral-xyz/anchor/dist/cjs/idl.js';
import { getAnchorProvider, getProgramId } from './provider.js';
import idl from '../chain-idl/safevault_link.json' assert { type: 'json' };

export interface RegisterCustodyParams {
  assetIdHex: string;
  docHashes: string[];
}

export interface CustodyRegistrationResult {
  signature: string | null;
  skipped: boolean;
  reason?: string;
}

const VAULT_SEED = Buffer.from('vault');
const CONFIG_SEED = Buffer.from('config');

function hexToBytes(value: string): number[] {
  const hex = value.startsWith('0x') ? value.slice(2) : value;
  return Array.from(Buffer.from(hex, 'hex'));
}

export function computeAssetId(label: string): string {
  const hash = createHash('sha256').update(label).digest('hex');
  return `0x${hash}`;
}

export async function registerCustody(params: RegisterCustodyParams): Promise<CustodyRegistrationResult> {
  if (process.env.SAFEVAULT_DISABLED === 'true') {
    return { signature: null, skipped: true, reason: 'SAFEVAULT_DISABLED flag set' };
  }

  let provider;
  try {
    provider = getAnchorProvider();
  } catch (error) {
    const reason = error instanceof Error ? `provider_error: ${error.message}` : 'provider_error';
    return { signature: null, skipped: true, reason };
  }

  const programId = getProgramId();
  const normalizedIdl = enrichIdlAccounts(idl);
  const coder = new BorshCoder(convertIdlToCamelCase(normalizedIdl));
  const program = new Program(normalizedIdl, provider, coder);

  const assetBytes = hexToBytes(params.assetIdHex);
  if (assetBytes.length !== 32) {
    throw new Error('assetIdHex must represent 32 bytes');
  }

  const docHashBytes = params.docHashes.map((hash) => {
    const bytes = hexToBytes(hash);
    if (bytes.length !== 32) {
      throw new Error(`Invalid 32-byte hash: ${hash}`);
    }
    return bytes;
  });

  const vaultSeed = [VAULT_SEED, Buffer.from(assetBytes)];
  const configSeed = [CONFIG_SEED];

  let vaultPda: PublicKey;
  let configPda: PublicKey;
  try {
    [vaultPda] = PublicKey.findProgramAddressSync(vaultSeed, programId);
    [configPda] = PublicKey.findProgramAddressSync(configSeed, programId);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { signature: null, skipped: true, reason };
  }

  try {
    const signature = await program.methods
      .registerCustody(assetBytes, docHashBytes)
      .accounts({
        vault: vaultPda,
        config: configPda,
        authority: provider.wallet.publicKey,
      })
      .rpc();

    return { signature, skipped: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { signature: null, skipped: true, reason };
  }
}

type GenericIdl = {
  accounts?: Array<{ name: string; type?: unknown }>;
  types?: Array<{ name: string; type: unknown }>;
};

function enrichIdlAccounts(rawIdl: GenericIdl): GenericIdl {
  if (!Array.isArray(rawIdl.accounts) || !Array.isArray(rawIdl.types)) {
    return rawIdl;
  }

  const typeIndex = new Map<string, unknown>();
  for (const typeDef of rawIdl.types) {
    typeIndex.set(typeDef.name, typeDef.type);
    typeIndex.set(typeDef.name.toLowerCase(), typeDef.type);
  }

  const accounts = rawIdl.accounts.map((account) => {
    if (account.type) {
      return account;
    }
    const matchedType = typeIndex.get(account.name) ?? typeIndex.get(account.name.toLowerCase());
    return matchedType ? { ...account, type: matchedType } : account;
  });

  return { ...rawIdl, accounts };
}
