#!/usr/bin/env tsx
import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Hex,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const envPath = process.env.ENV_FILE
  ? path.resolve(repoRoot, process.env.ENV_FILE)
  : path.resolve(repoRoot, '.env.demo');

if (existsSync(envPath)) {
  loadEnv({ path: envPath, override: false });
}

const DEFAULT_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const envRpcDefault = process.env.HARDHAT_RPC ?? 'http://anvil:8545';
const rpcUrlRaw = process.env.DEPLOY_RPC_URL ?? envRpcDefault;
const shouldRewriteForHost = !process.env.DEPLOY_RPC_URL && rpcUrlRaw.includes('anvil');
const rpcUrl = shouldRewriteForHost ? 'http://127.0.0.1:8545' : rpcUrlRaw;
const privateKey = (process.env.DEPLOY_PRIVATE_KEY ??
  process.env.ORCHESTRATOR_PRIVATE_KEY ??
  DEFAULT_PRIVATE_KEY) as Hex;
const chainId = Number(process.env.CHAIN_ID ?? 31337);

const chain = defineChain({
  id: chainId,
  name: 'sovereign-devnet',
  network: 'sovereign-devnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
});

const source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract SafeVaultDemo {
    mapping(bytes32 => bool) private custody;
    mapping(bytes32 => bytes32[]) private docs;

    event CustodySet(bytes32 indexed assetId, bool value);
    event DocAdded(bytes32 indexed assetId, bytes32 docHash);

    function setCustody(bytes32 assetId, bool value) external {
        custody[assetId] = value;
        emit CustodySet(assetId, value);
    }

    function setDoc(bytes32 assetId, bytes32 docHash) external {
        docs[assetId].push(docHash);
        emit DocAdded(assetId, docHash);
    }

    function hasCustody(bytes32 assetId) external view returns (bool) {
        return custody[assetId];
    }

    function getDocHashes(bytes32 assetId) external view returns (bytes32[] memory) {
        return docs[assetId];
    }
}

contract AffidavitRegistryDemo {
    struct Affidavit {
        bytes32 assetId;
        bytes32 documentHash;
        address witness;
        uint256 timestamp;
        bytes metadata;
    }

    mapping(bytes32 => Affidavit) private affidavits;
    mapping(bytes32 => bytes32) private latest;
    uint256 private counter;

    event AffidavitCreated(bytes32 indexed affidavitId, bytes32 indexed assetId);

    function createAffidavit(bytes32 assetId, bytes calldata meta) external returns (bytes32) {
        counter += 1;
        bytes32 affidavitId = keccak256(
            abi.encodePacked(assetId, meta, block.timestamp, counter, msg.sender)
        );
        bytes32 documentHash = keccak256(meta);
        affidavits[affidavitId] = Affidavit(assetId, documentHash, msg.sender, block.timestamp, meta);
        latest[assetId] = affidavitId;
        emit AffidavitCreated(affidavitId, assetId);
        return affidavitId;
    }

    function latestAffidavit(bytes32 assetId) external view returns (bytes32) {
        return latest[assetId];
    }

    function getAffidavit(bytes32 affidavitId) external view returns (Affidavit memory) {
        return affidavits[affidavitId];
    }
}

contract EklesiaAttestorDemo {
    struct Attestation {
        bytes32 subjectId;
        bytes32 payloadHash;
        bytes32 clause;
        uint256 timestamp;
        address attestor;
    }

    mapping(bytes32 => Attestation) private attestations;
    uint256 private counter;

    event Attested(bytes32 indexed attestationId, bytes32 indexed subjectId);

    function recordAttestation(
        bytes32 subjectId,
        bytes32 payloadHash,
        bytes32 clause
    ) external returns (bytes32) {
        counter += 1;
        bytes32 attestationId = keccak256(
            abi.encodePacked(subjectId, payloadHash, clause, block.timestamp, counter, msg.sender)
        );
        attestations[attestationId] = Attestation(subjectId, payloadHash, clause, block.timestamp, msg.sender);
        emit Attested(attestationId, subjectId);
        return attestationId;
    }

    function get(bytes32 attestationId) external view returns (Attestation memory) {
        return attestations[attestationId];
    }
}

contract VaultQuantDemo {
    struct Note {
        bytes32 assetId;
        uint8 instrumentType;
        uint256 par;
        uint256 nav;
        bytes32 affidavitId;
        bytes32 attestationId;
        bool active;
    }

    mapping(uint256 => Note) private notes;
    uint256 private nextNoteId = 1;
    uint256 public navCsdn;
    uint256 public navSdn;

    event NoteIssued(uint256 indexed noteId, bytes32 indexed assetId);

    function setAssetNAV(bytes32, uint256 navWei) external {
        navCsdn = navWei;
        navSdn = navWei / 2;
    }

    function issueCSDN(bytes32 assetId, uint256 par) external returns (uint256) {
        return _issue(assetId, 0, par);
    }

    function issueSDN(bytes32 assetId, uint256 par) external returns (uint256) {
        return _issue(assetId, 1, par);
    }

    function _issue(bytes32 assetId, uint8 instrument, uint256 par) private returns (uint256 noteId) {
        noteId = nextNoteId++;
        notes[noteId] = Note(assetId, instrument, par, par, bytes32(0), bytes32(0), true);
        emit NoteIssued(noteId, assetId);
    }

    function getNote(uint256 noteId) external view returns (Note memory) {
        return notes[noteId];
    }

    function getAggregateNAV() external view returns (uint256, uint256) {
        return (navCsdn, navSdn);
    }

    function updateNoteAttestation(uint256 noteId, bytes32 attestationId) external {
        notes[noteId].attestationId = attestationId;
    }

    function settleRedemption(uint256 noteId, uint256 amount) external {
        Note storage note = notes[noteId];
        if (amount >= note.par) {
            note.par = 0;
            note.active = false;
        } else {
            note.par -= amount;
        }
    }
}

contract MatriarchInsuranceDemo {
    uint256 private counter;
    uint256 private constant POLICY_FLOOR_BPS = 8000;

    event CoverageBound(bytes32 indexed binderId, bytes32 indexed assetId);

    function bindCoverage(
        bytes32 assetId,
        uint16 classCode,
        uint256 factorBps,
        bytes32 disclosureHash
    ) external returns (bytes32) {
        counter += 1;
        bytes32 binderId = keccak256(
            abi.encodePacked(assetId, classCode, factorBps, disclosureHash, counter, msg.sender)
        );
        emit CoverageBound(binderId, assetId);
        return binderId;
    }

    function getPolicyFloorBps() external pure returns (uint256) {
        return POLICY_FLOOR_BPS;
    }
}

contract KiiantuCyclesDemo {
    uint256 private counter;

    event CycleRun(bytes32 indexed cycleId, uint256 indexed noteId);

    function runCycle(
        uint256 noteId,
        uint16 tenorDays,
        uint16 rateBps
    ) external returns (bytes32) {
        counter += 1;
        bytes32 cycleId = keccak256(
            abi.encodePacked(noteId, tenorDays, rateBps, counter, block.timestamp)
        );
        emit CycleRun(cycleId, noteId);
        return cycleId;
    }
}

contract AnimaDemo {
    function ok(bytes32, bytes32) external pure returns (bool) {
        return true;
    }
}

contract HRVSTDemo {
    mapping(address => uint256) public balances;

    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    function mintByNAV(
        uint256 navCsdn,
        uint256 navSdn,
        uint256,
        address to
    ) external returns (uint256) {
        uint256 amount = navCsdn + navSdn;
        balances[to] += amount;
        emit Mint(to, amount);
        return amount;
    }

    function burnFrom(address holder, uint256 amount) external {
        uint256 balance = balances[holder];
        if (amount >= balance) {
            balances[holder] = 0;
        } else {
            balances[holder] = balance - amount;
        }
        emit Burn(holder, amount);
    }
}
`;

type CompileOutput = {
  contracts: Record<
    string,
    Record<
      string,
      {
        abi: unknown[];
        evm: { bytecode: { object: string } };
      }
    >
  >;
  errors?: Array<{ type: string; formattedMessage: string }>;
};

function compileContracts() {
  const input = {
    language: 'Solidity',
    sources: {
      'SovereignDemo.sol': {
        content: source,
      },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as CompileOutput;
  if (output.errors) {
    const fatal = output.errors.filter((err) => err.type !== 'Warning');
    if (fatal.length > 0) {
      const message = fatal.map((err) => err.formattedMessage.trim()).join('\n');
      throw new Error(`Compilation failed:\n${message}`);
    }
  }
  return output.contracts['SovereignDemo.sol'];
}

type Artifact = { abi: unknown[]; bytecode: Hex };

function getArtifact(contracts: ReturnType<typeof compileContracts>, name: string): Artifact {
  const contract = contracts[name];
  if (!contract?.evm?.bytecode?.object) {
    throw new Error(`Missing bytecode for contract ${name}`);
  }
  return {
    abi: contract.abi,
    bytecode: (`0x${contract.evm.bytecode.object}`) as Hex,
  };
}

async function deployContract(
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  artifact: Artifact,
): Promise<Hex> {
  const hash = await wallet.deployContract({
    abi: artifact.abi as any,
    bytecode: artifact.bytecode,
    args: [],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error(`Deployment failed for tx ${hash}`);
  }
  return receipt.contractAddress as Hex;
}

function updateEnvFile(filePath: string, updates: Record<string, string>) {
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const lines = existing.split(/\r?\n/);
  const seen = new Set<string>();

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      return line;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      return line;
    }
    const key = line.slice(0, eqIndex).trim();
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      seen.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      updatedLines.push(`${key}=${value}`);
    }
  }

  const content = updatedLines.join('\n');
  writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

async function main() {
  console.log(`Deploying demo contracts to ${rpcUrl} (chain id ${chainId})`);
  const compiled = compileContracts();

  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl, { timeout: 60_000 });
  const wallet = createWalletClient({ account, chain, transport });
  const publicClient = createPublicClient({ chain, transport });

  const contracts: Record<string, Hex> = {};

  const deployments: Array<[string, string]> = [
    ['SAFEVAULT_ADDRESS', 'SafeVaultDemo'],
    ['EYEION_ADDRESS', 'AffidavitRegistryDemo'],
    ['EKLESIA_ADDRESS', 'EklesiaAttestorDemo'],
    ['VAULTQUANT_ADDRESS', 'VaultQuantDemo'],
    ['MATRIARCH_ADDRESS', 'MatriarchInsuranceDemo'],
    ['KIANITU_ADDRESS', 'KiiantuCyclesDemo'],
    ['ANIMA_ADDRESS', 'AnimaDemo'],
    ['HRVST_ADDRESS', 'HRVSTDemo'],
  ];

  for (const [envKey, contractName] of deployments) {
    const artifact = getArtifact(compiled, contractName);
    const address = await deployContract(wallet, publicClient, artifact);
    contracts[envKey] = address;
    console.log(`  - ${contractName} -> ${address}`);
  }

  const envUpdates: Record<string, string> = {
    HARDHAT_RPC: envRpcDefault,
    ORCHESTRATOR_PRIVATE_KEY: privateKey,
    CONTRACTS_MODE: 'CHAIN',
    ...contracts,
  };

  updateEnvFile(envPath, envUpdates);
  console.log(`\nUpdated environment file: ${path.relative(repoRoot, envPath)}`);
  for (const [key, value] of Object.entries(envUpdates)) {
    console.log(`  ${key}=${value}`);
  }
  console.log('\nDemo contract deployment complete.');
}

main().catch((error) => {
  console.error('Failed to deploy demo contracts:', error);
  process.exit(1);
});
