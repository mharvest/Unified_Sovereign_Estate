import fs from 'node:fs/promises';
import path from 'node:path';

export type RequiredInput = {
  key: string;
  description: string;
  category: string;
  requiredInDemo: boolean;
  requiredInLive: boolean;
};

export const REQUIRED_INPUTS: RequiredInput[] = [
  {
    key: 'DEMO_MODE',
    description: 'Set to true when running in demo isolation',
    category: 'mode',
    requiredInDemo: false,
    requiredInLive: false,
  },
  {
    key: 'LIVE_MODE',
    description: 'Set to true only after Trustee sign-off and evidence readiness',
    category: 'mode',
    requiredInDemo: false,
    requiredInLive: false,
  },
  {
    key: 'SOLANA_RPC_URL',
    description: 'RPC endpoint for Solana execution (devnet/mainnet)',
    category: 'chain',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'SOLANA_EXPLORER_BASE',
    description: 'Base URL for Solana transaction explorer links',
    category: 'chain',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'EKLESIA_ADDRESS',
    description: 'Private L1 attestation contract address',
    category: 'contracts',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'SAFEVAULT_ADDRESS',
    description: 'SafeVault custody contract/program address',
    category: 'contracts',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'EYEION_ADDRESS',
    description: 'Eyeion affidavit program address',
    category: 'contracts',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'VAULTQUANT_ADDRESS',
    description: 'VaultQuant issuance controller address',
    category: 'contracts',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'MATRIARCH_ADDRESS',
    description: 'Matriarch multiplier program address',
    category: 'contracts',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'HRVST_ADDRESS',
    description: 'HRVST SPL mint / ERC20 address',
    category: 'contracts',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'KIIANTU_ADDRESS',
    description: 'Kiiantu liquidity orchestration program address',
    category: 'contracts',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'ANIMA_ADDRESS',
    description: 'Anima override/policy registry address',
    category: 'contracts',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'JWT_PUBLIC_KEY_BASE64',
    description: 'Base64-encoded JWT verification key',
    category: 'security',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'INTERNAL_MTLS_CA_BASE64',
    description: 'Base64 PEM CA for internal mTLS trust',
    category: 'security',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'INTERNAL_MTLS_CERT_BASE64',
    description: 'Base64 PEM client certificate for internal calls',
    category: 'security',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'INTERNAL_MTLS_KEY_BASE64',
    description: 'Base64 PEM client key for internal calls',
    category: 'security',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'AES_KEYRING_BASE64',
    description: 'Base64 encoded AES keyring for sealed secrets',
    category: 'security',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'CUSTODY_ALPHA_HASKINS_SHA256',
    description: 'SHA-256 hash for Haskins custody dossier',
    category: 'evidence',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'CUSTODY_BETA_COMPTON_SHA256',
    description: 'SHA-256 hash for Compton #24 custody dossier',
    category: 'evidence',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'ACTUARIAL_TABLES_JSON_SHA256',
    description: 'SHA-256 hash of Matriarch actuarial tables JSON',
    category: 'evidence',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'NAV_FEED_ENDPOINT',
    description: 'Internal URL for NAV oracle feed',
    category: 'oracle',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'NAV_FEED_SIGNING_PUBKEY',
    description: 'Ed25519 NAV oracle signing public key',
    category: 'oracle',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'SMTP_URL',
    description: 'SMTP endpoint for notifications',
    category: 'notifications',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'SAFEVAULT_IPFS_API',
    description: 'SafeVault IPFS API endpoint',
    category: 'notifications',
    requiredInDemo: false,
    requiredInLive: true,
  },
  {
    key: 'SAFEVAULT_IPFS_TOKEN',
    description: 'SafeVault IPFS API token',
    category: 'notifications',
    requiredInDemo: false,
    requiredInLive: true,
  },
];

export interface MissingInput {
  key: string;
  description: string;
  category: string;
}

export function collectMissingInputs(): {
  base: MissingInput[];
  live: MissingInput[];
  demoMode: boolean;
  liveMode: boolean;
} {
  const demoMode = (process.env.DEMO_MODE ?? 'true').toLowerCase() === 'true';
  const liveMode = (process.env.LIVE_MODE ?? 'false').toLowerCase() === 'true';

  const missingBase: MissingInput[] = [];
  const missingLive: MissingInput[] = [];

  for (const item of REQUIRED_INPUTS) {
    const value = process.env[item.key];
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed.length > 0) {
      continue;
    }
    if (item.requiredInDemo) {
      missingBase.push({ key: item.key, description: item.description, category: item.category });
    } else if (item.requiredInLive) {
      missingLive.push({ key: item.key, description: item.description, category: item.category });
    }
  }

  return { base: missingBase, live: missingLive, demoMode, liveMode };
}

export async function updateEvidenceDoc(missing: MissingInput[]): Promise<void> {
  const docLines: string[] = [
    '# Needed Evidence Log',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ];

  if (missing.length === 0) {
    docLines.push('All required evidence and configuration values are present. Ready for LIVE_MODE enablement.');
  } else {
    const byCategory = new Map<string, MissingInput[]>();
    for (const entry of missing) {
      if (!byCategory.has(entry.category)) {
        byCategory.set(entry.category, []);
      }
      byCategory.get(entry.category)!.push(entry);
    }

    docLines.push('The following items are still required before LIVE_MODE can be enabled:');
    docLines.push('');
    for (const [category, rows] of byCategory.entries()) {
      docLines.push(`## ${category.toUpperCase()}`);
      for (const row of rows) {
        docLines.push(`- ${row.key} — ${row.description}`);
      }
      docLines.push('');
    }
  }

  const configuredPath = process.env.NEEDED_EVIDENCE_PATH;
  const docPath = configuredPath
    ? path.resolve(configuredPath)
    : path.resolve(process.cwd(), '..', 'docs', 'needed-evidence.md');
  await fs.mkdir(path.dirname(docPath), { recursive: true });
  await fs.writeFile(docPath, docLines.join('\n'), 'utf8');
}

export function missingToTodoList(items: MissingInput[]): string[] {
  return items.map((item) => `${item.key}: ${item.description}`);
}
