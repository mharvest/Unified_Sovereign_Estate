import 'dotenv/config';
import { createPublicClient, http, parseAbi } from 'viem';
import { writeFile, readFile } from 'fs/promises';
import { access } from 'fs/promises';
import { constants } from 'fs';
import { createHash } from 'crypto';

const offlineMode = process.env.ORACLE_OFFLINE === 'true';
const rpcUrl = process.env.RPC_URL;
const csdnAddress = process.env.CSDN_ADDRESS;
const routerAddress = process.env.ROUTER_ADDRESS;
const safevaultCachePath = process.env.SAFEVAULT_CACHE_PATH || './safevault-cache.json';
const eyeionApiBase = process.env.EYEION_API_BASE;

if (!offlineMode && (!rpcUrl || !csdnAddress || !eyeionApiBase)) {
  console.error('Missing required env vars: RPC_URL, CSDN_ADDRESS, EYEION_API_BASE');
  process.exit(1);
}

const eklesiaChain = rpcUrl
  ? {
      id: Number(process.env.CHAIN_ID ?? 777),
      name: 'Eklesia',
      network: 'eklesia',
      nativeCurrency: { name: 'HRVST', symbol: 'HRVST', decimals: 18 },
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] }
      }
    }
  : null;

const csdnAbi = parseAbi([
  'event Originated(uint256 indexed noteId, bytes32 indexed docHash, uint256 principal, address indexed originator)',
  'event Issued(uint256 indexed noteId, address indexed issuer)',
  'event Insured(uint256 indexed noteId, uint256 insuredAmount, address indexed underwriter)',
  'event Subscribed(uint256 indexed noteId, address indexed lp, uint256 amount, address indexed operator)',
  'event DistributionMarked(uint256 indexed noteId, address indexed lp, uint256 amount, address indexed executor)',
  'event Redeemed(uint256 indexed noteId, address indexed lp, uint256 amount, address indexed executor)',
  'event DocHashUpdated(uint256 indexed noteId, bytes32 indexed docHash, address indexed updater)'
]);

const routerAbi = parseAbi([
  'event KYCSubscribed(address indexed lp, uint256 indexed noteId, uint256 amount, bytes32 leaf, address indexed escrow)'
]);

const client = !offlineMode && eklesiaChain ? createPublicClient({ chain: eklesiaChain, transport: http(rpcUrl) }) : null;

let safevaultCache = { documents: {} };
const noteToDocHash = new Map();

const normalize = (value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, v]) => [key, normalize(v)]);
    return Object.fromEntries(entries);
  }
  return value;
};

async function loadCache() {
  try {
    await access(safevaultCachePath, constants.R_OK);
    const data = await readFile(safevaultCachePath, 'utf8');
    safevaultCache = JSON.parse(data);
  } catch (err) {
    console.warn('Starting fresh SafeVault cache');
  }
}

async function persistCache() {
  await writeFile(safevaultCachePath, JSON.stringify(safevaultCache, null, 2));
}

async function pinToIpfs(payload) {
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const cid = `ipfs://mock-${hash.slice(0, 46)}`;
  return { cid };
}

async function getBlockMetadata(blockNumber) {
  if (!client) {
    return { timestamp: Date.now(), hash: '0xoffline' };
  }
  const block = await client.getBlock({ blockNumber });
  return { timestamp: Number(block.timestamp), hash: block.hash };
}

async function postWithRetry(path, body, attempt = 1) {
  const url = `${eyeionApiBase}${path}`;
  if (eyeionApiBase === 'mock') {
    return { status: 'mocked', url, body };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      if ((res.status >= 500 || res.status === 429) && attempt < 5) {
        const delayMs = 500 * attempt;
        console.warn(`Retrying ${path} in ${delayMs}ms (attempt ${attempt})`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return postWithRetry(path, body, attempt + 1);
      }
      throw new Error(`Eyeion API error ${res.status}`);
    }
    return await res.json().catch(() => ({}));
  } catch (err) {
    if (attempt >= 5) {
      console.error('Failed to post to Eyeion', err.message);
      throw err;
    }
    const delayMs = 500 * attempt;
    console.warn(`Retrying ${path} after error: ${err.message}`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return postWithRetry(path, body, attempt + 1);
  }
}

async function handleEvent(event) {
  const { blockNumber, transactionHash, args, eventName } = event;
  const metadata = await getBlockMetadata(blockNumber);
  const payload = {
    event: eventName,
    args: normalize(args ?? {}),
    blockNumber: Number(blockNumber),
    txHash: transactionHash,
    timestamp: metadata.timestamp,
    blockHash: metadata.hash
  };

  const ipfs = await pinToIpfs(payload);
  payload.ipfs = ipfs;

  let docHash = args.docHash || null;
  if (!docHash && typeof args.noteId !== 'undefined') {
    docHash = noteToDocHash.get(Number(args.noteId)) || null;
  }
  if (!docHash && args.leaf) {
    docHash = args.leaf;
  }

  if (eventName === 'Originated') {
    await postWithRetry('/register', payload);
    if (docHash) {
      noteToDocHash.set(Number(args.noteId), docHash);
      safevaultCache.documents[docHash] = { lastEvent: eventName, history: [payload] };
      await persistCache();
    }
    return;
  }

  if (docHash && !safevaultCache.documents[docHash]) {
    console.warn(`Doc hash ${docHash} missing in SafeVault cache; registering retroactively`);
    safevaultCache.documents[docHash] = { lastEvent: 'backfill', history: [] };
  }

  if (docHash) {
    safevaultCache.documents[docHash].lastEvent = eventName;
    safevaultCache.documents[docHash].history.push(payload);
    if (eventName === 'DocHashUpdated') {
      noteToDocHash.set(Number(args.noteId), docHash);
    }
    await persistCache();
  }

  await postWithRetry('/verify/append', payload);
}

async function main() {
  await loadCache();

  if (offlineMode) {
    console.log('Eyeion oracle running in offline mode (no chain listeners attached).');
    return;
  }

  console.log('Eyeion oracle starting...');
  console.log(`Watching CSDN at ${csdnAddress}`);

  client.watchContractEvent({
    address: csdnAddress,
    abi: csdnAbi,
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          await handleEvent(log);
        } catch (err) {
          console.error('Failed to process CSDN event', err);
        }
      }
    }
  });

  if (routerAddress) {
    client.watchContractEvent({
      address: routerAddress,
      abi: routerAbi,
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            await handleEvent(log);
          } catch (err) {
            console.error('Failed to process router event', err);
          }
        }
      }
    });
  }
}

main().catch((err) => {
  console.error('Oracle crashed', err);
  process.exit(1);
});
