#!/usr/bin/env node
import { config } from 'dotenv';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const definitions = [
  {
    key: 'DEMO_MODE',
    description: 'Set to true when running in demo isolation',
    requiredInDemo: false,
    requiredInLive: false,
    category: 'mode',
  },
  {
    key: 'LIVE_MODE',
    description: 'Set to true only after Trustee sign-off and evidence readiness',
    requiredInDemo: false,
    requiredInLive: false,
    category: 'mode',
  },
  {
    key: 'SOLANA_RPC_URL',
    description: 'RPC endpoint for Solana execution (devnet/mainnet)',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'chain',
  },
  {
    key: 'SOLANA_EXPLORER_BASE',
    description: 'Base URL for Solana transaction explorer links',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'chain',
  },
  {
    key: 'EKLESIA_ADDRESS',
    description: 'Private L1 attestation contract address',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'contracts',
  },
  {
    key: 'SAFEVAULT_ADDRESS',
    description: 'SafeVault custody contract/program address',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'contracts',
  },
  {
    key: 'EYEION_ADDRESS',
    description: 'Eyeion affidavit program address',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'contracts',
  },
  {
    key: 'VAULTQUANT_ADDRESS',
    description: 'VaultQuant issuance controller address',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'contracts',
  },
  {
    key: 'MATRIARCH_ADDRESS',
    description: 'Matriarch multiplier program address',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'contracts',
  },
  {
    key: 'HRVST_ADDRESS',
    description: 'HRVST SPL mint / ERC20 address',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'contracts',
  },
  {
    key: 'KIIANTU_ADDRESS',
    description: 'Kiiantu liquidity orchestration program address',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'contracts',
  },
  {
    key: 'ANIMA_ADDRESS',
    description: 'Anima override/policy registry address',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'contracts',
  },
  {
    key: 'JWT_PUBLIC_KEY_BASE64',
    description: 'Base64-encoded JWT verification key',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'security',
  },
  {
    key: 'INTERNAL_MTLS_CA_BASE64',
    description: 'Base64 PEM CA for internal mTLS trust',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'security',
  },
  {
    key: 'INTERNAL_MTLS_CERT_BASE64',
    description: 'Base64 PEM client certificate for internal calls',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'security',
  },
  {
    key: 'INTERNAL_MTLS_KEY_BASE64',
    description: 'Base64 PEM client key for internal calls',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'security',
  },
  {
    key: 'AES_KEYRING_BASE64',
    description: 'Base64 encoded AES keyring for sealed secrets',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'security',
  },
  {
    key: 'CUSTODY_ALPHA_HASKINS_SHA256',
    description: 'SHA-256 hash for Haskins custody dossier',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'evidence',
  },
  {
    key: 'CUSTODY_BETA_COMPTON_SHA256',
    description: 'SHA-256 hash for Compton #24 custody dossier',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'evidence',
  },
  {
    key: 'ACTUARIAL_TABLES_JSON_SHA256',
    description: 'SHA-256 hash of Matriarch actuarial tables JSON',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'evidence',
  },
  {
    key: 'NAV_FEED_ENDPOINT',
    description: 'Internal URL for NAV oracle feed',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'oracle',
  },
  {
    key: 'NAV_FEED_SIGNING_PUBKEY',
    description: 'Ed25519 NAV oracle signing public key',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'oracle',
  },
  {
    key: 'SMTP_URL',
    description: 'SMTP endpoint for notifications',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'notifications',
  },
  {
    key: 'SAFEVAULT_IPFS_API',
    description: 'SafeVault IPFS API endpoint',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'notifications',
  },
  {
    key: 'SAFEVAULT_IPFS_TOKEN',
    description: 'SafeVault IPFS API token',
    requiredInDemo: false,
    requiredInLive: true,
    category: 'notifications',
  },
];

const loadEnvFile = (filePath) => {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) {
    return false;
  }
  config({ path: resolved, override: true });
  return true;
};

let loaded = false;
const envFile = process.env.ENV_FILE;
if (envFile) {
  loaded = loadEnvFile(envFile);
  if (!loaded) {
    console.warn(`Specified ENV_FILE=${envFile} was not found. Falling back to defaults.`);
  }
}

if (!loaded) {
  const attempt = config();
  loaded = Boolean(attempt?.parsed);
}

if (!loaded) {
  const fallbacks = ['../.env', '../.env.demo', '../.env.live'];
  for (const candidate of fallbacks) {
    if (loadEnvFile(candidate)) {
      loaded = true;
      break;
    }
  }
}

const demoMode = ((process.env.DEMO_MODE ?? 'true').toString().trim().toLowerCase() === 'true');
const liveMode = ((process.env.LIVE_MODE ?? 'false').toString().trim().toLowerCase() === 'true');

const missingAlways = [];
const missingLiveOnly = [];

for (const def of definitions) {
  const raw = process.env[def.key];
  const value = typeof raw === 'string' ? raw.trim() : '';
  const isMissing = value.length === 0;
  if (!isMissing) continue;

  if (def.requiredInDemo) {
    missingAlways.push(def);
  } else if (def.requiredInLive) {
    missingLiveOnly.push(def);
  }
}

const lines = [];
lines.push('HRVST Sovereign Liquidity & Governance Engine — Environment Verification');
lines.push(`Mode: DEMO_MODE=${demoMode} LIVE_MODE=${liveMode}`);
lines.push('');

if (missingAlways.length > 0) {
  lines.push('BLOCKER: Required environment keys are missing (cannot run regardless of mode):');
  for (const def of missingAlways) {
    lines.push(` - ${def.key}: ${def.description}`);
  }
} else {
  lines.push('Found all base environment keys.');
}

if (missingLiveOnly.length > 0) {
  lines.push('');
  lines.push('Pending before enabling LIVE_MODE:');
  for (const def of missingLiveOnly) {
    lines.push(` - ${def.key}: ${def.description}`);
  }
} else {
  lines.push('');
  lines.push('Live-mode requirements satisfied.');
}

const output = lines.join('\n');
console.log(output);

const missingForDoc = [...missingAlways, ...missingLiveOnly];
const docLines = [
  '# Needed Evidence Log',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
];

if (missingForDoc.length === 0) {
  docLines.push('All required evidence and configuration values are present. Ready for LIVE_MODE enablement.');
} else {
  const sections = new Map();
  for (const item of missingForDoc) {
    if (!sections.has(item.category)) {
      sections.set(item.category, []);
    }
    sections.get(item.category).push(item);
  }

  docLines.push('The following items are still required before LIVE_MODE can be enabled:');
  docLines.push('');
  for (const [category, items] of sections.entries()) {
    docLines.push(`## ${category.toUpperCase()}`);
    for (const item of items) {
      docLines.push(`- ${item.key} — ${item.description}`);
    }
    docLines.push('');
  }
}

const docPath = path.resolve(process.cwd(), '..', 'docs', 'needed-evidence.md');
await fs.writeFile(docPath, docLines.join('\n'));

if (missingAlways.length > 0) {
  process.exitCode = 1;
  process.exit();
}

if (liveMode && missingLiveOnly.length > 0) {
  console.error('LIVE_MODE=true but required keys are missing. See docs/needed-evidence.md for details.');
  process.exit(1);
}

if (!demoMode && !liveMode) {
  console.warn('DEMO_MODE and LIVE_MODE are both false. Ensure modes are configured.');
}
